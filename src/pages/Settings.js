import React, { useState, useEffect } from "react";
import { supabase } from "../pages/supabaseClient";
import { useUser } from "../pages/UserContext";
import "./Settings.css";

function Settings() {
    const { user, setUser } = useUser();
    const [profile, setProfile] = useState({
        username: user?.username || "",
        status: user?.status || "Активен",
        role: user?.role || "",
    });
    const [password, setPassword] = useState({ current: "", new: "", confirm: "" });
    const [toastMessage, setToastMessage] = useState("");
    const [toastState, setToastState] = useState("hidden");
    const [toastType, setToastType] = useState("success");
    const [loading, setLoading] = useState(false);

    const validateNoCyrillic = (value, fieldName) => {
        if (/[а-яА-ЯёЁ]/.test(value)) {
            return `"${fieldName}" не должно содержать русские символы`;
        }
        return "";
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        const usernameError = validateNoCyrillic(profile.username, "Имя пользователя");
        if (usernameError) {
            setToastMessage(usernameError);
            setToastType("error");
            setToastState("visible");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from("users")
                .update({ username: profile.username })
                .eq("id", user.id);
            if (error) throw error;

            setUser({ ...user, username: profile.username });
            setToastMessage("Профиль успешно обновлён");
            setToastType("success");
            setToastState("visible");
        } catch (error) {
            setToastMessage(
                error.message.includes("row-level security")
                    ? "Ошибка: Недостаточно прав (RLS). Обратитесь к администратору."
                    : "Ошибка обновления профиля: " + error.message
            );
            setToastType("error");
            setToastState("visible");
            console.error("Ошибка обновления профиля:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (!password.current || !password.new || !password.confirm) {
            setToastMessage("Пожалуйста, заполните все поля");
            setToastType("error");
            setToastState("visible");
            return;
        }

        const currentError = validateNoCyrillic(password.current, "Текущий пароль");
        const newError = validateNoCyrillic(password.new, "Новый пароль");
        const confirmError = validateNoCyrillic(password.confirm, "Подтверждение пароля");

        if (currentError || newError || confirmError) {
            setToastMessage(currentError || newError || confirmError);
            setToastType("error");
            setToastState("visible");
            return;
        }

        if (password.new !== password.confirm) {
            setToastMessage("Пароли не совпадают");
            setToastType("error");
            setToastState("visible");
            return;
        }

        setLoading(true);
        try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password.current,
            });
            if (signInError || !signInData.user) {
                throw new Error("Текущий пароль неверный");
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: password.new,
            });
            if (updateError) throw updateError;

            setToastMessage("Пароль успешно изменён");
            setToastType("success");
            setToastState("visible");
            setPassword({ current: "", new: "", confirm: "" });
        } catch (error) {
            setToastMessage(error.message);
            setToastType("error");
            setToastState("visible");
            console.error("Ошибка смены пароля:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let timer;
        if (toastState === "visible") {
            timer = setTimeout(() => setToastState("hiding"), 3000);
        } else if (toastState === "hiding") {
            timer = setTimeout(() => setToastState("hidden"), 300);
        }
        return () => clearTimeout(timer);
    }, [toastState]);

    if (!user) return null;

    return (
        <div className="settings">
            <h2>Настройки</h2>
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <div className="settings-container">
                <div className="settings-section">
                    <h3>Профиль</h3>
                    <form onSubmit={handleProfileUpdate}>
                        <div className="form-group">
                            <label>Имя пользователя</label>
                            <input
                                type="text"
                                value={profile.username}
                                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Статус</label>
                            <input type="text" value={profile.status} disabled />
                        </div>
                        <div className="form-group">
                            <label>Роль</label>
                            <input type="text" value={profile.role} disabled />
                        </div>
                        <button type="submit" disabled={loading}>
                            Обновить профиль
                        </button>
                    </form>
                </div>
                <div className="settings-section">
                    <h3>Изменить пароль</h3>
                    <form onSubmit={handlePasswordChange}>
                        <div className="form-group">
                            <label>Текущий пароль</label>
                            <input
                                type="password"
                                value={password.current}
                                onChange={(e) => setPassword({ ...password, current: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Новый пароль</label>
                            <input
                                type="password"
                                value={password.new}
                                onChange={(e) => setPassword({ ...password, new: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Подтвердите пароль</label>
                            <input
                                type="password"
                                value={password.confirm}
                                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                        <button type="submit" disabled={loading}>
                            Изменить пароль
                        </button>
                    </form>
                </div>
            </div>
            {toastState !== "hidden" && (
                <div className={`toast ${toastState} ${toastType}`}>{toastMessage}</div>
            )}
        </div>
    );
}

export default Settings;