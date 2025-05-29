import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { useUser } from "./UserContext";
import "./UserManagement.css";

function UserManagement() {
    const { user } = useUser();
    const [users, setUsers] = useState([]);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [newUser, setNewUser] = useState({ username: "", role: "Пользователь" });
    const [errors, setErrors] = useState({ username: "" });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ message: "", type: "", visible: false, hiding: false });

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from("users").select("*");
            if (error) throw error;
            setUsers(data || []);
            showToast("Пользователи успешно загружены", "success");
        } catch (error) {
            console.error("Ошибка загрузки пользователей:", error.message);
            showToast("Ошибка загрузки пользователей", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const showToast = (message, type) => {
        setToast({ message, type, visible: true, hiding: false });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, hiding: true }));
            setTimeout(() => setToast({ message: "", type: "", visible: false, hiding: false }), 300);
        }, 3000);
    };

    const validateField = (fieldName, value) => {
        if (!value.trim()) return "Поле не может быть пустым";
        if (/[а-яА-ЯёЁ]/.test(value) && fieldName !== "role") return "Русские символы запрещены";
        return "";
    };

    const handleEditUser = (user) => {
        setCurrentUser(user);
        setNewUser({ username: user.username, role: user.role });
        setIsEditingUser(true);
        setErrors({ username: "" });
    };

    const handleSaveEdit = async () => {
        const usernameError = validateField("username", newUser.username);
        if (usernameError) {
            setErrors({ username: usernameError });
            return;
        }

        setLoading(true);
        try {
            if (user?.role !== "Администратор") {
                throw new Error("Недостаточно прав для редактирования пользователя");
            }

            const { error } = await supabase
                .from("users")
                .update({ username: newUser.username, role: newUser.role })
                .eq("id", currentUser.id);
            if (error) throw error;

            setNewUser({ username: "", role: "Пользователь" });
            setErrors({ username: "" });
            setIsEditingUser(false);
            setCurrentUser(null);
            showToast("Пользователь успешно обновлен", "success");
            await fetchUsers();
        } catch (error) {
            console.error("Ошибка обновления пользователя:", error.message);
            setErrors({ username: "Ошибка обновления" });
            showToast("Ошибка обновления пользователя", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async () => {
        if (!currentUser) {
            showToast("Пользователь не выбран", "error");
            return;
        }

        setLoading(true);
        try {
            if (user?.role !== "Администратор") {
                throw new Error("Недостаточно прав для бана пользователя");
            }

            const { error } = await supabase
                .from("users")
                .update({ is_banned: true })
                .eq("id", currentUser.id);
            if (error) throw error;

            setIsEditingUser(false);
            setCurrentUser(null);
            showToast("Пользователь успешно забанен", "success");
            await fetchUsers();
        } catch (error) {
            console.error("Ошибка бана пользователя:", error.message);
            showToast("Ошибка бана пользователя", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUnbanUser = async () => {
        if (!currentUser) {
            showToast("Пользователь не выбран", "error");
            return;
        }

        setLoading(true);
        try {
            if (user?.role !== "Администратор") {
                throw new Error("Недостаточно прав для разбана пользователя");
            }

            const { error } = await supabase
                .from("users")
                .update({ is_banned: false })
                .eq("id", currentUser.id);
            if (error) throw error;

            setIsEditingUser(false);
            setCurrentUser(null);
            showToast("Пользователь успешно разбанен", "success");
            await fetchUsers();
        } catch (error) {
            console.error("Ошибка разбана пользователя:", error.message);
            showToast("Ошибка разбана пользователя", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setNewUser({ username: "", role: "Пользователь" });
        setErrors({ username: "" });
        setIsEditingUser(false);
        setCurrentUser(null);
    };

    const handleInputChange = (field, value) => {
        setNewUser({ ...newUser, [field]: value });
        const error = validateField(field, value);
        setErrors({ ...errors, [field]: error });
    };

    if (!user || user.role !== "Администратор") return <div>Доступ запрещен</div>;

    return (
        <div className="user-management">
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            {toast.visible && (
                <div className={`error-toast ${toast.hiding ? "hiding" : "visible"} ${toast.type}`}>
                    {toast.message}
                </div>
            )}
            <div className="users-header">
                <h2>Управление пользователями</h2>
            </div>
            {isEditingUser && (
                <div className="add-user-form">
                    <h3>Редактировать пользователя</h3>
                    <div className="form-group">
                        <label>Логин</label>
                        <input type="text" value={newUser.username} onChange={(e) => handleInputChange("username", e.target.value)} />
                        {errors.username && <span className="error">{errors.username}</span>}
                    </div>
                    <div className="form-group">
                        <label>Роль</label>
                        <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                            <option>Администратор</option>
                            <option>Помощник</option>
                            <option>Пользователь</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Статус</label>
                        <input type="text" value={currentUser?.status || "Обычный"} disabled />
                    </div>
                    <div className="form-buttons">
                        <div className="save-cancel-buttons">
                            <button onClick={handleSaveEdit} disabled={loading}>
                                Сохранить изменения
                            </button>
                            <button className="cancel" onClick={handleCancel} disabled={loading}>
                                Отмена
                            </button>
                        </div>
                        <div className="ban-unban-buttons">
                            {currentUser?.is_banned ? (
                                <button className="unban" onClick={handleUnbanUser} disabled={loading}>
                                    Разбанить
                                </button>
                            ) : (
                                <button className="ban" onClick={handleBanUser} disabled={loading}>
                                    Забанить
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="users-table">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Логин</th>
                            <th>Роль</th>
                            <th>Статус</th>
                            <th>Забанен</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="6">Пользователи не найдены</td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>
                                    <td>{user.role}</td>
                                    <td>{user.status}</td>
                                    <td>{user.is_banned ? "Да" : "Нет"}</td>
                                    <td className="actions">
                                        <button className="edit" onClick={() => handleEditUser(user)} disabled={loading}>
                                            Редактировать
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default UserManagement;