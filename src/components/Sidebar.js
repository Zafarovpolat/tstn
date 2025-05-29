import React, { useEffect, useCallback } from "react";
import { supabase } from "../pages/supabaseClient";
import { useUser } from "../pages/UserContext";
import "./Sidebar.css";
import logo from "../img/IMG_0139.png";

function Sidebar({ currentPage, setCurrentPage, onLogout }) {
    const { user } = useUser();

    const handleMenuClick = useCallback(
        (page) => {
            setCurrentPage(page);
        },
        [setCurrentPage]
    );

    const isAdmin = user?.role === "Администратор";
    const canViewOrders = user?.role === "Администратор" || user?.role === "Помощник";

    const handleLogout = async () => {
        try {
            if (user?.id) {
                const { error } = await supabase
                    .from("users")
                    .update({
                        status: "Оффлайн",
                        last_active: new Date().toISOString(),
                    })
                    .eq("id", user.id);
                if (error) throw error;
            }
            await supabase.auth.signOut();
            onLogout();
        } catch (error) {
            console.error("Ошибка при выходе:", error.message);
        }
    };

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden && user?.id) {
                try {
                    await supabase
                        .from("users")
                        .update({
                            status: "Оффлайн",
                            last_active: new Date().toISOString(),
                        })
                        .eq("id", user.id);
                } catch (error) {
                    console.error("Ошибка обновления статуса:", error);
                }
            }
        };

        const handleBeforeUnload = () => {
            if (user?.id) {
                const url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`;
                const body = JSON.stringify({
                    status: "Оффлайн",
                    last_active: new Date().toISOString(),
                });
                navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [user]);

    if (!user) return null;

    return (
        <nav className="sidebar" role="navigation" aria-label="Главное меню">
            <div className="logo" role="banner">
                <img src={logo} alt="Логотип" />
            </div>
            <div className="user-info" role="complementary" aria-label="Информация о пользователе">
                <div className="avatar" role="img" aria-label={`Аватар ${user?.username || "пользователя"}`}>
                    {user?.username?.[0] || "U"}
                </div>
                <div className="user-details">
                    <p>{user?.username || "Пользователь"}</p>
                    <span>{user?.role || "Роль"}</span>
                </div>
            </div>
            <div className="menu">
                <ul role="menubar">
                    {isAdmin && (
                        <li role="none">
                            <button
                                role="menuitem"
                                className={currentPage === "dashboard" ? "active" : ""}
                                onClick={() => handleMenuClick("dashboard")}
                                aria-current={currentPage === "dashboard"}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path
                                        d="M2 4C2 3.44772 2.44772 3 3 3H6C6.55228 3 7 3.44772 7 4V7C7 7.55228 6.55228 8 6 8H3C2.44772 8 2 7.55228 2 7V4ZM9 4C9 3.44772 9.44772 3 10 3H13C13.5523 3 14 3.44772 14 4V7C14 7.55228 13.5523 8 13 8H10C9.44772 8 9 7.55228 9 7V4ZM2 9C2 8.44772 2.44772 8 3 8H6C6.55228 8 7 8.44772 7 9V12C7 12.5523 6.55228 13 6 13H3C2.44772 13 2 12.5523 2 12V9ZM9 9C9 8.44772 9.44772 8 10 8H13C13.5523 8 14 8.44772 14 9V12C14 12.5523 13.5523 13 13 13H10C9.44772 13 9 12.5523 9 12V9Z"
                                        fill="#586A84"
                                    />
                                </svg>
                                <span className="menu-text">Дашборд</span>
                            </button>
                        </li>
                    )}
                    {isAdmin && (
                        <li role="none">
                            <button
                                role="menuitem"
                                className={currentPage === "users" ? "active" : ""}
                                onClick={() => handleMenuClick("users")}
                                aria-current={currentPage === "users"}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path
                                        d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8ZM8 9C5.79086 9 4 10.7909 4 13H12C12 10.7909 10.2091 9 8 9ZM13 5C13 6.10457 12.1046 7 11 7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5C11.5523 5 12 4.55228 12 4C12 3.44772 12.4477 3 13 3C13.5523 3 14 3.44772 14 4C14 4.55228 13.5523 5 13 5ZM3 7C3.55228 7 4 6.55228 4 6C4 5.44772 3.55228 5 3 5C2.44772 5 2 4.55228 2 4C2 3.44772 2.44772 3 3 3C3.55228 3 4 3.44772 4 4C4 4.55228 3.55228 5 3 5C2.44772 5 2 5.44772 2 6C2 6.55228 2.44772 7 3 7Z"
                                        fill="#586A84"
                                    />
                                </svg>
                                <span className="menu-text">Пользователи</span>
                            </button>
                        </li>
                    )}
                    {isAdmin && (
                        <li role="none">
                            <button
                                role="menuitem"
                                className={currentPage === "products" ? "active" : ""}
                                onClick={() => handleMenuClick("products")}
                                aria-current={currentPage === "products"}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path
                                        d="M2 12H5L7 8L9 10L11 6L14 12H2ZM2 4V2H14V4H2ZM2 14V16H14V14H2Z"
                                        fill="#586A84"
                                    />
                                </svg>
                                <span className="menu-text">Активность</span>
                            </button>
                        </li>
                    )}
                    {canViewOrders && (
                        <li role="none">
                            <button
                                role="menuitem"
                                className={currentPage === "orders" ? "active" : ""}
                                onClick={() => handleMenuClick("orders")}
                                aria-current={currentPage === "orders"}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path
                                        d="M3 2C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V3C14 2.44772 13.5523 2 13 2H3ZM4 4H12V5H4V4ZM4 6H12V7H4V6ZM4 8H12V9H4V8ZM4 10H9V11H4V10Z"
                                        fill="#586A84"
                                    />
                                </svg>
                                <span className="menu-text">Заказы</span>
                            </button>
                        </li>
                    )}
                    {isAdmin && (
                        <li role="none">
                            <button
                                role="menuitem"
                                className={currentPage === "logs" ? "active" : ""}
                                onClick={() => handleMenuClick("logs")}
                                aria-current={currentPage === "logs"}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path
                                        d="M3 2C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V3C14 2.44772 13.5523 2 13 2H3ZM4 4H12V5H4V4ZM4 6H12V7H4V6ZM4 8H12V9H4V8Z"
                                        fill="#586A84"
                                    />
                                </svg>
                                <span className="menu-text">Логи</span>
                            </button>
                        </li>
                    )}
                    <li role="none">
                        <button
                            role="menuitem"
                            className={currentPage === "assistant" ? "active" : ""}
                            onClick={() => handleMenuClick("assistant")}
                            aria-current={currentPage === "assistant"}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path
                                    d="M8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2ZM8 12C5.79086 12 4 10.2091 4 8C4 5.79086 5.79086 4 8 4C10.2091 4 12 5.79086 12 8C12 10.2091 10.2091 12 8 12ZM8 5C6.89543 5 6 5.89543 6 7H7C7 6.44772 7.44772 6 8 6C8.55228 6 9 6.44772 9 7C9 7.55228 8.55228 8 8 8C7.44772 8 7 7.55228 7 7H8V5ZM8 9C8.55228 9 9 9.44772 9 10V11H7V10C7 9.44772 7.44772 9 8 9Z"
                                    fill="#586A84"
                                />
                            </svg>
                            <span className="menu-text">Помощник</span>
                        </button>
                    </li>
                    <li role="none">
                        <button
                            role="menuitem"
                            className={currentPage === "settings" ? "active" : ""}
                            onClick={() => handleMenuClick("settings")}
                            aria-current={currentPage === "settings"}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path
                                    d="M6.586 2.686C7.259 2.243 8.126 2 9 2C9.874 2 10.741 2.243 11.414 2.686L12.828 1.272C12.578 1.098 12.288 1 11.978 1H4.022C3.712 1 3.422 1.098 3.172 1.272L4.586 2.686ZM9 6C10.1046 6 11 5.10457 11 4C11 2.89543 10.1046 2 9 2C7.89543 2 7 2.89543 7 4C7 5.10457 7.89543 6 9 6ZM13.414 3.686C13.741 4.263 14 4.941 14 5.5C14 6.059 13.741 6.737 13.414 7.314L14.828 8.728C15.078 8.554 15.288 8.341 15.478 8.108L15.828 7.728L14.414 6.314L14.586 5.686ZM2.586 3.686C2.259 4.263 2 4.941 2 5.5C2 6.059 2.259 6.737 2.586 7.314L1.172 8.728C0.922 8.554 0.712 8.341 0.522 8.108L0.172 7.728L1.586 6.314L1.414 5.686ZM6.586 13.314C7.259 13.757 8.126 14 9 14C9.874 14 10.741 13.757 11.414 13.314L12.828 14.728C12.578 14.902 12.288 15 11.978 15H4.022C3.712 15 3.422 14.902 3.172 14.728L4.586 13.314ZM9 10C7.89543 10 7 10.8954 7 12C7 13.1046 7.89543 14 9 14C10.1046 14 11 13.1046 11 12C11 10.8954 10.1046 10 9 10Z"
                                    fill="#586A84"
                                />
                            </svg>
                            <span className="menu-text">Настройки</span>
                        </button>
                    </li>
                </ul>
            </div>
            <div className="logout">
                <button onClick={handleLogout} aria-label="Выйти из системы">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                            d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C9.933 15 11.5997 14.263 12.799 13H10C9.44772 13 9 12.5523 9 12C9 11.4477 9.44772 11 10 11H14C14.5523 11 15 11.4477 15 12V14C15 14.5523 14.5523 15 14 15H13C13 15.5523 12.5523 16 12 16C11.4477 16 11 15.5523 11 15H8C3.58172 15 0 11.4183 0 7C0 2.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 7C16 7.55228 15.5523 8 15 8C14.4477 8 14 7.55228 14 7C14 4.23858 11.7614 2 9 2C6.23858 2 4 4.23858 4 7C4 9.76142 6.23858 12 9 12C9.55228 12 10 12.4477 10 13C10 13.5523 9.55228 14 9 14C5.13401 14 2 10.866 2 7C2 3.13401 5.13401 0 9 0C10.6569 0 12 0.89543 13 2.41421V2C13 1.44772 13.4477 1 14 1C14.5523 1 15 1.44772 15 2V5C15 5.55228 14.5523 6 14 6C13.4477 6 13 5.55228 13 5V4.58579C12 3.10457 10.6569 2 9 2Z"
                            fill="#e53e3e"
                        />
                    </svg>
                    <span className="menu-text">Выход</span>
                </button>
            </div>
        </nav>
    );
}

export default Sidebar;