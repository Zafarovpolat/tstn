import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../pages/supabaseClient";
import { useUser } from "../pages/UserContext";
import "./Orders.css";

function Orders() {
    const { user } = useUser();
    const BASE_URL = "https://t.me/+";
    const BOT_TOKEN = process.env.REACT_APP_BOT_TOKEN; // Токен из переменной окружения
    const CHAT_ID = "7987200974"; // Для новых заказов, если chat_id не указан

    const [orders, setOrders] = useState([]);
    const [isAddingOrder, setIsAddingOrder] = useState(false);
    const [isViewingOrder, setIsViewingOrder] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [newOrder, setNewOrder] = useState({
        client: "",
        url: "",
        amount: 300000,
        dateTime: "",
        status: "Ожидание",
    });
    const [errors, setErrors] = useState({
        client: "",
        url: "",
        amount: "",
        dateTime: "",
        status: "",
    });
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [toast, setToast] = useState({ message: "", type: "", visible: false, hiding: false });

    const sendTelegramMessage = async (chatId, message) => {
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

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error("Ошибка загрузки заказов:", error.message);
            showToast("Ошибка загрузки заказов", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsAdmin(user?.role === "Администратор");
        fetchOrders();
    }, [user, fetchOrders]);

    const validateField = (fieldName, value) => {
        if (!value && value !== 0) return "Поле не может быть пустым";
        if (fieldName === "client" && !value.trim()) return "Поле не может быть пустым";
        if (fieldName === "dateTime" && !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
            return "Формат: MM-DD HH:MM";
        }
        if (fieldName === "url") {
            const urlPart = value.replace(BASE_URL, "");
            if (!urlPart) return "URL не может быть пустым";
            if (/[^a-zA-Z0-9-]/.test(urlPart)) return "Только англ. буквы, цифры и дефис";
        }
        if (fieldName === "amount") {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue <= 0) return "Сумма должна быть положительным числом";
        }
        return "";
    };

    const handleAddOrder = async () => {
        const clientError = validateField("client", newOrder.client);
        const urlError = validateField("url", `${BASE_URL}${newOrder.url}`);
        const amountError = validateField("amount", newOrder.amount);
        const dateTimeError = validateField("dateTime", newOrder.dateTime);

        if (clientError || urlError || amountError || dateTimeError) {
            setErrors({
                client: clientError,
                url: urlError,
                amount: amountError,
                dateTime: dateTimeError,
                status: "",
            });
            return;
        }

        setLoading(true);
        try {
            const fullUrl = `${BASE_URL}${newOrder.url}`;
            const { error } = await supabase.from("orders").insert([
                {
                    client: newOrder.client.trim(),
                    url: fullUrl,
                    amount: Number(newOrder.amount),
                    date_time: newOrder.dateTime,
                    status: "Ожидание",
                    user_id: user.id,
                    chat_id: null,
                },
            ]);
            if (error) throw error;

            showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");

            setNewOrder({ client: "", url: "", amount: 300000, dateTime: "", status: "Ожидание" });
            setErrors({ client: "", url: "", amount: "", dateTime: "", status: "" });
            setIsAddingOrder(false);
            showToast("Заказ успешно добавлен", "success");
            await fetchOrders();
        } catch (error) {
            console.error("Ошибка добавления заказа:", error.message);
            showToast("Ошибка добавления заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleViewOrder = (order) => {
        setCurrentOrder(order);
        setNewOrder({
            client: order.client,
            url: order.url.replace(BASE_URL, ""),
            amount: order.amount,
            dateTime: order.date_time,
            status: order.status || "Ожидание",
        });
        setIsViewingOrder(true);
        setIsAddingOrder(false);
        setErrors({ client: "", url: "", amount: "", dateTime: "", status: "" });
    };

    const handleAccept = async () => {
        const clientError = validateField("client", newOrder.client);
        const urlError = validateField("url", `${BASE_URL}${newOrder.url}`);
        const amountError = validateField("amount", newOrder.amount);
        const dateTimeError = validateField("dateTime", newOrder.dateTime);

        if (clientError || urlError || amountError || dateTimeError) {
            setErrors({
                client: clientError,
                url: urlError,
                amount: amountError,
                dateTime: dateTimeError,
                status: "",
            });
            return;
        }

        setLoading(true);
        try {
            const fullUrl = `${BASE_URL}${newOrder.url}`;
            if (currentOrder.chat_id) {
                await sendTelegramMessage(
                    currentOrder.chat_id,
                    `Ваш заказ одобрен!\nСсылка: ${fullUrl}\nСумма: ${Number(newOrder.amount).toLocaleString()} UZS`
                );
            } else {
                showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
            }

            const { error } = await supabase
                .from("orders")
                .update({
                    client: newOrder.client.trim(),
                    url: fullUrl,
                    amount: Number(newOrder.amount),
                    date_time: newOrder.dateTime,
                    status: "Одобрено",
                    approved_by: user.id,
                })
                .eq("id", currentOrder.id);
            if (error) throw error;

            setIsViewingOrder(false);
            setCurrentOrder(null);
            showToast("Заказ успешно одобрен", "success");
            await fetchOrders();
        } catch (error) {
            console.error("Ошибка обновления заказа:", error.message);
            showToast("Ошибка одобрения заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        try {
            if (currentOrder.chat_id) {
                await sendTelegramMessage(
                    currentOrder.chat_id,
                    `Ваш заказ был отклонён.\nКлиент: ${currentOrder.client}\nСумма: ${currentOrder.amount.toLocaleString()} UZS`
                );
            } else {
                showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
            }

            const { error } = await supabase.from("orders").delete().eq("id", currentOrder.id);
            if (error) throw error;

            setIsViewingOrder(false);
            setCurrentOrder(null);
            showToast("Заказ отклонён", "success");
            await fetchOrders();
        } catch (error) {
            console.error("Ошибка удаления заказа:", error.message);
            showToast("Ошибка отклонения заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteApproved = async () => {
        if (!isAdmin) return;

        setLoading(true);
        try {
            if (currentOrder.chat_id) {
                await sendTelegramMessage(
                    currentOrder.chat_id,
                    `Заказ удалён администратором.\nКлиент: ${currentOrder.client}\nСумма: ${currentOrder.amount.toLocaleString()} UZS`
                );
            } else {
                showToast("Уведомление не отправлено: заказ добавлен вручную", "warning");
            }

            const { error } = await supabase.from("orders").delete().eq("id", currentOrder.id);
            if (error) throw error;

            setIsViewingOrder(false);
            setCurrentOrder(null);
            showToast("Заказ успешно удалён", "success");
            await fetchOrders();
        } catch (error) {
            console.error("Ошибка удаления заказа:", error.message);
            showToast("Ошибка удаления заказа", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setNewOrder({ client: "", url: "", amount: 300000, dateTime: "", status: "Ожидание" });
        setErrors({ client: "", url: "", amount: "", dateTime: "", status: "" });
        setIsAddingOrder(false);
        setIsViewingOrder(false);
        setCurrentOrder(null);
    };

    const handleBack = () => {
        setIsViewingOrder(false);
        setCurrentOrder(null);
    };

    const handleInputChange = (field, value) => {
        const processedValue = field === "amount" ? value.replace(/[^0-9]/g, "") : value;
        setNewOrder((prev) => ({ ...prev, [field]: processedValue }));
        const error = validateField(field, field === "url" ? `${BASE_URL}${processedValue}` : processedValue);
        setErrors((prev) => ({ ...prev, [field]: error }));
    };

    const handleImageClick = () => {
        setIsFullScreen(true);
    };

    const handleCloseFullScreen = () => {
        setIsFullScreen(false);
    };

    const showToast = (message, type) => {
        setToast({ message, type, visible: true, hiding: false });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, hiding: true }));
            setTimeout(() => setToast({ message: "", type: "", visible: false, hiding: false }), 300);
        }, 3000);
    };

    const isOrderEditable = (order) => {
        return order?.status === "Ожидание";
    };

    if (!user) return null;

    return (
        <div className="orders">
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <div className="orders-header">
                <h1>Управление заказами</h1>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setIsAddingOrder(true);
                            setIsViewingOrder(false);
                            setCurrentOrder(null);
                        }}
                        disabled={loading}
                    >
                        Добавить заказ
                    </button>
                )}
            </div>
            {toast.visible && (
                <div className={`notification-error ${toast.hiding ? "hiding" : "visible"} ${toast.type}`}>
                    {toast.message}
                </div>
            )}
            {isAddingOrder && (
                <div className="order-form">
                    <h3>Добавить заказ</h3>
                    <div className="form-group">
                        <label>Клиент</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.client}
                                onChange={(e) => handleInputChange("client", e.target.value)}
                                disabled={loading}
                                className={errors.client ? "input-error" : ""}
                            />
                            {errors.client && <span className="error-inside">{errors.client}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>URL</label>
                        <div className="url-input-wrapper">
                            <span className="url-prefix">{BASE_URL}</span>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    value={newOrder.url}
                                    onChange={(e) => handleInputChange("url", e.target.value)}
                                    disabled={loading}
                                    className={errors.url ? "input-error" : ""}
                                />
                                {errors.url && <span className="error-inside">{errors.url}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Сумма (UZS)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.amount}
                                onChange={(e) => handleInputChange("amount", e.target.value)}
                                disabled={loading}
                                className={errors.amount ? "input-error" : ""}
                            />
                            {errors.amount && <span className="error-inside">{errors.amount}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Дата и время (MM-DD HH:MM)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.dateTime}
                                onChange={(e) => handleInputChange("dateTime", e.target.value)}
                                placeholder="MM-DD HH:MM"
                                disabled={loading}
                                className={errors.dateTime ? "input-error" : ""}
                            />
                            {errors.dateTime && <span className="error-inside">{errors.dateTime}</span>}
                        </div>
                    </div>
                    <div className="form-buttons">
                        <button onClick={handleAddOrder} disabled={loading}>
                            Сохранить
                        </button>
                        <button className="cancel" onClick={handleCancel} disabled={loading}>
                            Отмена
                        </button>
                    </div>
                </div>
            )}
            {isViewingOrder && currentOrder && (
                <div className="order-form">
                    <h3>Просмотр заказа</h3>
                    <div className="form-group">
                        <label>Клиент</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.client}
                                onChange={(e) => handleInputChange("client", e.target.value)}
                                disabled={loading || !isOrderEditable(currentOrder)}
                                className={errors.client ? "input-error" : ""}
                            />
                            {errors.client && <span className="error-inside">{errors.client}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>URL</label>
                        <div className="url-input-wrapper">
                            <span className="url-prefix">{BASE_URL}</span>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    value={newOrder.url}
                                    onChange={(e) => handleInputChange("url", e.target.value)}
                                    disabled={loading || !isOrderEditable(currentOrder)}
                                    className={errors.url ? "input-error" : ""}
                                />
                                {errors.url && <span className="error-inside">{errors.url}</span>}
                            </div>
                        </div>
                        {currentOrder.photo_url && (
                            <div className="order-photo">
                                <img src={currentOrder.photo_url} alt="Фото заказа" onClick={handleImageClick} />
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Сумма (UZS)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.amount}
                                onChange={(e) => handleInputChange("amount", e.target.value)}
                                disabled={loading || !isOrderEditable(currentOrder)}
                                className={errors.amount ? "input-error" : ""}
                            />
                            {errors.amount && <span className="error-inside">{errors.amount}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Дата и время (MM-DD HH:MM)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={newOrder.dateTime}
                                onChange={(e) => handleInputChange("dateTime", e.target.value)}
                                placeholder="MM-DD HH:MM"
                                disabled={loading || !isOrderEditable(currentOrder)}
                                className={errors.dateTime ? "input-error" : ""}
                            />
                            {errors.dateTime && <span className="error-inside">{errors.dateTime}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Статус</label>
                        <input type="text" value={newOrder.status} disabled />
                    </div>
                    <div className="form-buttons">
                        {isOrderEditable(currentOrder) && (
                            <>
                                <button onClick={handleAccept} disabled={loading}>
                                    Принять
                                </button>
                                <button className="cancel" onClick={handleReject} disabled={loading}>
                                    Отказать
                                </button>
                            </>
                        )}
                        {isAdmin && currentOrder.status === "Одобрено" && (
                            <button className="cancel" onClick={handleDeleteApproved} disabled={loading}>
                                Удалить
                            </button>
                        )}
                        <button className="cancel" onClick={handleBack} disabled={loading}>
                            Назад
                        </button>
                    </div>
                </div>
            )}
            {isFullScreen && currentOrder?.photo_url && (
                <div className="fullscreen-overlay" onClick={handleCloseFullScreen}>
                    <img src={currentOrder.photo_url} alt="Фото заказа" className="fullscreen-image" />
                </div>
            )}
            {!isAddingOrder && !isViewingOrder && (
                <div className="orders-table">
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
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7">Заказы не найдены</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id}>
                                        <td>{order.id}</td>
                                        <td>{order.client}</td>
                                        <td>
                                            <a href={order.url} target="_blank" rel="noopener noreferrer">
                                                {order.url}
                                            </a>
                                        </td>
                                        <td>{order.amount.toLocaleString()} UZS</td>
                                        <td>{order.date_time}</td>
                                        <td>{order.status}</td>
                                        <td className="actions">
                                            <button
                                                className="view"
                                                onClick={() => handleViewOrder(order)}
                                                disabled={loading}
                                            >
                                                Просмотреть
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default Orders;
