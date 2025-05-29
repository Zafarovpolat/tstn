import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./Login.css";

function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [toastState, setToastState] = useState("hidden");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError("Пожалуйста, заполните все поля");
            setToastState("visible");
            return;
        }

        setIsLoading(true);
        setError("");
        setToastState("hidden");

        try {
            // Вход через Supabase Auth
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError || !data.user) {
                console.error("Ошибка аутентификации:", authError);
                setError(authError.message === "Invalid login credentials" ? "Неверный email или пароль" : authError.message);
                setToastState("visible");
                setIsLoading(false);
                return;
            }

            // Получаем данные пользователя из public.users
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, role, username, is_banned, status, last_active")
                .eq("id", data.user.id)
                .single();

            if (userError || !userData) {
                console.error("Ошибка получения данных пользователя:", userError);
                setError("Ошибка загрузки данных пользователя");
                setToastState("visible");
                await supabase.auth.signOut();
                setIsLoading(false);
                return;
            }

            // Проверка на бан пользователя
            if (userData.is_banned) {
                setError("Ваш аккаунт заблокирован");
                setToastState("visible");
                await supabase.auth.signOut();
                setIsLoading(false);
                return;
            }

            // Вызываем onLogin для обновления состояния в App.js
            onLogin({
                id: userData.id,
                username: userData.username,
                role: userData.role,
            });
        } catch (err) {
            console.error("Общая ошибка входа:", err);
            setError("Ошибка сервера. Попробуйте позже.");
            setToastState("visible");
        } finally {
            setIsLoading(false);
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

    return (
        <div className="login-container">
            <div className="login-form">
                <h2>Вход</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">
                            Email
                            {!email && <span style={{ color: "#3B4758" }}>*</span>}
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Введите ваш email"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">
                            Пароль
                            {!password && <span style={{ color: "#3B4758" }}>*</span>}
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Введите ваш пароль"
                            disabled={isLoading}
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={isLoading}>
                        {isLoading ? <span className="button-loader">Проверка...</span> : "Войти"}
                    </button>
                </form>
            </div>
            {toastState !== "hidden" && (
                <div className={`error-toast ${toastState}`}>{error}</div>
            )}
        </div>
    );
}

export default Login;