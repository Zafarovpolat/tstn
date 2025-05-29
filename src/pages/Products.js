import React, { useState, useEffect, useCallback } from "react";
import { supabase, setCurrentUserId } from "../pages/supabaseClient";
import { useUser } from "../pages/UserContext"; // Предполагается, что есть UserContext
import "./Products.css";

function Products() {
    const BASE_URL = "https://example.com/";
    const BOT_TOKEN = process.env.REACT_APP_BOT_TOKEN; // Токен из переменной окружения
    const CHAT_ID = "7987200974"; // Для новых заказов, если chat_id не указан

    const { user } = useUser();
    const [products, setProducts] = useState([]);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({
        client: "",
        url: "",
        date_time: "",
        amount: "",
    });
    const [errors, setErrors] = useState({
        client: "",
        url: "",
        date_time: "",
        amount: "",
    });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ message: "", type: "", visible: false, hiding: false });

    const sendTelegramMessage = async (chatId, message) => {
        // Проверяем наличие chat_id перед отправкой
        if (!chatId) {
            console.warn("chat_id отсутствует, сообщение не отправлено");
            showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
            return false;
        }
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: "Markdown",
                    }),
                }
            );
            const result = await response.json();
            if (!result.ok) {
                throw new Error(`Ошибка отправки сообщения в Telegram: ${result.description}`);
            }
            return true;
        } catch (error) {
            console.error("Ошибка отправки уведомления в Telegram:", error.message);
            showToast("Не удалось отправить уведомление в Telegram", "error");
            return false;
        }
    };

    const fetchApprovedOrders = useCallback(async () => {
        console.log("Products.js: Fetching approved orders...");
        setLoading(true);
        try {
            if (user?.id) {
                await setCurrentUserId(user.id);
            }
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .eq("status", "Одобрено")
                .order("created_at", { ascending: false });
            if (error) throw error;
            console.log("Products.js: Fetched orders:", data);
            setProducts(data || []);
        } catch (error) {
            console.error("Ошибка загрузки одобренных заказов:", error.message);
            showToast("Ошибка загрузки заказов", "error");
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchApprovedOrders();

        const subscription = supabase
            .channel("orders-channel")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                (payload) => {
                    if (payload.eventType === "INSERT" && payload.new.status === "Одобрено") {
                        setProducts((prev) => {
                            if (prev.some((product) => product.id === payload.new.id)) return prev;
                            return [...prev, payload.new];
                        });
                    } else if (payload.eventType === "UPDATE") {
                        setProducts((prev) => {
                            if (payload.new.status === "Одобрено") {
                                return prev.map((product) =>
                                    product.id === payload.new.id ? payload.new : product
                                );
                            } else {
                                return prev.filter((product) => product.id !== payload.new.id);
                            }
                        });
                    } else if (payload.eventType === "DELETE") {
                        setProducts((prev) => prev.filter((product) => product.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [fetchApprovedOrders]);

    const validateField = (fieldName, value) => {
        if (fieldName === "client" && !value.trim()) {
            return "Клиент не может быть пустым";
        }
        if (fieldName === "url") {
            const fullUrl = `${BASE_URL}${value}`;
            const urlPart = value;
            if (!urlPart) return "URL не может быть пустым";
            if (/[^a-zA-Z0-9-]/.test(urlPart)) return "Используйте только английские буквы, цифры и дефис";
        }
        if (fieldName === "date_time") {
            if (!value.trim()) return "Дата и время не могут быть пустыми";
            if (!/^\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return "Формат: MM-DD HH:MM";
        }
        if (fieldName === "amount" && (!/^\d+$/.test(value) || parseInt(value) <= 0)) {
            return "Сумма должна быть положительным числом";
        }
        return "";
    };

    const handleAddProduct = async () => {
        const clientError = validateField("client", newProduct.client);
        const urlError = validateField("url", newProduct.url);
        const dateTimeError = validateField("date_time", newProduct.date_time);
        const amountError = validateField("amount", newProduct.amount);

        if (clientError || urlError || dateTimeError || amountError) {
            setErrors({
                client: clientError,
                url: urlError,
                date_time: dateTimeError,
                amount: amountError,
            });
            return;
        }

        setLoading(true);
        try {
            const fullUrl = `${BASE_URL}${newProduct.url}`;
            const { error } = await supabase.from("orders").insert([
                {
                    client: newProduct.client.trim(),
                    url: fullUrl,
                    date_time: newProduct.date_time,
                    amount: parseInt(newProduct.amount),
                    status: "Одобрено",
                    created_by: user.id,
                    chat_id: null, // Для вручную добавленных заказов chat_id = null
                },
            ]);
            if (error) throw error;

            // Для новых заказов уведомление не отправляется, так как они добавлены вручную
            showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");

            setNewProduct({ client: "", url: "", date_time: "", amount: "" });
            setErrors({ client: "", url: "", date_time: "", amount: "" });
            setIsAddingProduct(false);
            showToast("Заказ успешно добавлен", "success");
            await fetchApprovedOrders();
        } catch (error) {
            console.error("Ошибка добавления заказа:", error.message);
            showToast("Ошибка добавления заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEditProduct = (product) => {
        setCurrentProduct(product);
        setNewProduct({
            client: product.client,
            url: product.url.replace(BASE_URL, ""),
            date_time: product.date_time,
            amount: product.amount.toString(),
        });
        setIsEditingProduct(true);
        setIsAddingProduct(false);
        setErrors({ client: "", url: "", date_time: "", amount: "" });
    };

    const handleSaveEdit = async () => {
        const clientError = validateField("client", newProduct.client);
        const urlError = validateField("url", newProduct.url);
        const dateTimeError = validateField("date_time", newProduct.date_time);
        const amountError = validateField("amount", newProduct.amount);

        if (clientError || urlError || dateTimeError || amountError) {
            setErrors({
                client: clientError,
                url: urlError,
                date_time: dateTimeError,
                amount: amountError,
            });
            return;
        }

        setLoading(true);
        try {
            const fullUrl = `${BASE_URL}${newProduct.url}`;
            const { error } = await supabase
                .from("orders")
                .update({
                    client: newProduct.client.trim(),
                    url: fullUrl,
                    date_time: newProduct.date_time,
                    amount: parseInt(newProduct.amount),
                })
                .eq("id", currentProduct.id);
            if (error) throw error;

            // Отправляем уведомление только если есть chat_id
            if (currentProduct.chat_id) {
                await sendTelegramMessage(
                    currentProduct.chat_id,
                    `Заказ обновлён:\nКлиент: ${newProduct.client}\nURL: ${fullUrl}\nДата и время: ${newProduct.date_time}\nСумма: ${newProduct.amount} UZS`
                );
            } else {
                showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
            }

            setNewProduct({ client: "", url: "", date_time: "", amount: "" });
            setErrors({ client: "", url: "", date_time: "", amount: "" });
            setIsEditingProduct(false);
            setCurrentProduct(null);
            showToast("Заказ успешно обновлён", "success");
            await fetchApprovedOrders();
        } catch (error) {
            console.error("Ошибка обновления заказа:", error.message);
            showToast("Ошибка обновления заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async () => {
        if (currentProduct) {
            setLoading(true);
            try {
                const { error } = await supabase
                    .from("orders")
                    .delete()
                    .eq("id", currentProduct.id);
                if (error) throw error;

                // Отправляем уведомление только если есть chat_id
                if (currentProduct.chat_id) {
                    await sendTelegramMessage(
                        currentProduct.chat_id,
                        `Заказ удалён: ${currentProduct.client}`
                    );
                } else {
                    showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
                }

                setNewProduct({ client: "", url: "", date_time: "", amount: "" });
                setErrors({ client: "", url: "", date_time: "", amount: "" });
                setIsEditingProduct(false);
                setCurrentProduct(null);
                showToast("Заказ успешно удалён", "success");
                await fetchApprovedOrders();
            } catch (error) {
                console.error("Ошибка удаления заказа:", error.message);
                showToast("Ошибка удаления заказа", "error");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCancel = () => {
        setNewProduct({ client: "", url: "", date_time: "", amount: "" });
        setErrors({ client: "", url: "", date_time: "", amount: "" });
        setIsAddingProduct(false);
        setIsEditingProduct(false);
        setCurrentProduct(null);
    };

    const handleInputChange = (field, value) => {
        setNewProduct((prev) => ({ ...prev, [field]: value }));
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
    };

    const showToast = (message, type) => {
        setToast({ message, type, visible: true, hiding: false });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, hiding: true }));
            setTimeout(() => setToast({ message: "", type: "", visible: false, hiding: false }), 300);
        }, 3000);
    };

    if (!user || user.role !== "Администратор") return <div>Доступ запрещён</div>;

    return (
        <div className="products">
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <div className="products-header">
                <h2>Одобренные заказы (Продукты)</h2>
                <button
                    onClick={() => {
                        setIsAddingProduct(true);
                        setIsEditingProduct(false);
                        setCurrentProduct(null);
                    }}
                    disabled={loading}
                >
                    Добавить заказ
                </button>
            </div>
            {toast.visible && (
                <div className={`notification-error ${toast.hiding ? "hiding" : "visible"} ${toast.type}`}>
                    {toast.message}
                </div>
            )}
            {(isAddingProduct || isEditingProduct) && (
                <div className="add-product-form">
                    <h3>{isAddingProduct ? "Добавить заказ" : "Редактировать заказ"}</h3>
                    <div className="form-group">
                        <label>Клиент</label>
                        <input
                            type="text"
                            value={newProduct.client}
                            onChange={(e) => handleInputChange("client", e.target.value)}
                            disabled={loading}
                        />
                        {errors.client && <span className="error">{errors.client}</span>}
                    </div>
                    <div className="form-group">
                        <label>URL</label>
                        <div className="url-input-wrapper">
                            <span className="url-prefix">{BASE_URL}</span>
                            <input
                                type="text"
                                value={newProduct.url}
                                onChange={(e) => handleInputChange("url", e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        {errors.url && <span className="error">{errors.url}</span>}
                    </div>
                    <div className="form-group">
                        <label>Дата и время</label>
                        <input
                            type="text"
                            value={newProduct.date_time}
                            onChange={(e) => handleInputChange("date_time", e.target.value)}
                            placeholder="MM-DD HH:MM"
                            disabled={loading}
                        />
                        {errors.date_time && <span className="error">{errors.date_time}</span>}
                    </div>
                    <div className="form-group">
                        <label>Сумма (UZS)</label>
                        <input
                            type="text"
                            value={newProduct.amount}
                            onChange={(e) => handleInputChange("amount", e.target.value)}
                            disabled={loading}
                        />
                        {errors.amount && <span className="error">{errors.amount}</span>}
                    </div>
                    <div className="form-buttons">
                        <div className="save-cancel-buttons">
                            <button
                                onClick={isAddingProduct ? handleAddProduct : handleSaveEdit}
                                disabled={loading}
                            >
                                {isAddingProduct ? "Добавить" : "Сохранить изменения"}
                            </button>
                            <button className="cancel" onClick={handleCancel} disabled={loading}>
                                Отмена
                            </button>
                        </div>
                        {isEditingProduct && (
                            <button className="delete" onClick={handleDeleteProduct} disabled={loading}>
                                Удалить
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="products-table">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Клиент</th>
                            <th>URL</th>
                            <th>Сумма</th>
                            <th>Дата и время</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan="7">Заказы не найдены</td>
                            </tr>
                        ) : (
                            products.map((product) => (
                                <tr key={product.id}>
                                    <td>{product.id}</td>
                                    <td>{product.client}</td>
                                    <td>{product.url}</td>
                                    <td>{product.amount.toLocaleString()} UZS</td>
                                    <td>{product.date_time}</td>
                                    <td>{product.status}</td>
                                    <td className="actions">
                                        <button
                                            className="edit"
                                            onClick={() => handleEditProduct(product)}
                                            disabled={loading}
                                        >
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

export default Products;