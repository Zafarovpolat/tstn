import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const lastUserId = useRef(null); // Кэшируем ID последнего пользователя
    const fetchTimeout = useRef(null); // Для дебаунсинга

    const fetchUser = async () => {
        console.log("UserContext: fetchUser called");
        try {
            console.log("UserContext: Запрашиваем пользователя из Supabase...");
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError) {
                console.error("UserContext: Ошибка Supabase auth:", authError.message);
                setUser(null);
                setIsLoading(false);
                return false;
            }

            if (authUser) {
                // Проверяем, не тот ли это пользователь
                if (lastUserId.current === authUser.id) {
                    console.log("UserContext: Пользователь не изменился, пропускаем запрос");
                    setIsLoading(false);
                    return true;
                }

                const { data: userData, error: userError } = await supabase
                    .from("users")
                    .select("id, role, username, is_banned, status, last_active")
                    .eq("id", authUser.id)
                    .single();

                if (userError) {
                    console.error("UserContext: Ошибка получения данных пользователя:", userError.message);
                    setUser(null);
                    setIsLoading(false);
                    return false;
                }

                const userInfo = {
                    id: userData.id,
                    email: authUser.email,
                    role: userData.role,
                    username: userData.username,
                    isBanned: userData.is_banned,
                    status: userData.status,
                    lastActive: userData.last_active,
                };
                setUser(userInfo);
                lastUserId.current = userInfo.id;
                console.log("UserContext: Пользователь успешно загружен:", userInfo);
                return true;
            } else {
                console.log("UserContext: Пользователь не авторизован");
                setUser(null);
                lastUserId.current = null;
                setIsLoading(false);
                return false;
            }
        } catch (err) {
            console.error("UserContext: Неизвестная ошибка при загрузке пользователя:", err);
            setUser(null);
            lastUserId.current = null;
            setIsLoading(false);
            return false;
        }
    };

    const updateUserStatus = async (status, userId) => {
        console.log(`UserContext: updateUserStatus called with status=${status}, userId=${userId}`);
        try {
            if (!userId) {
                console.error("UserContext: userId не предоставлен");
                return false;
            }

            // Проверяем, совпадает ли userId с текущим пользователем
            if (user && user.id !== userId) {
                console.warn(`UserContext: userId ${userId} не совпадает с текущим пользователем ${user.id}`);
                return false;
            }

            const updates = {
                status,
                last_active: new Date().toISOString(),
            };

            const { error } = await supabase
                .from("users")
                .update(updates)
                .eq("id", userId);

            if (error) {
                console.error("UserContext: Ошибка обновления статуса:", error.message);
                return false;
            }

            setUser((prev) => prev ? { ...prev, status, lastActive: new Date().toISOString() } : null);
            console.log(`UserContext: Статус пользователя ${userId} обновлён на ${status}`);
            return true;
        } catch (err) {
            console.error("UserContext: Ошибка при обновлении статуса:", err);
            return false;
        }
    };

    useEffect(() => {
        // Дебаунсинг fetchUser
        const debouncedFetchUser = () => {
            if (fetchTimeout.current) {
                clearTimeout(fetchTimeout.current);
            }
            fetchTimeout.current = setTimeout(() => {
                fetchUser();
            }, 500); // Задержка 500 мс
        };

        debouncedFetchUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("UserContext: Auth state changed:", event, "session:", !!session);
            if (event === "SIGNED_IN" && session?.user) {
                debouncedFetchUser();
            } else if (event === "SIGNED_OUT") {
                setUser(null);
                lastUserId.current = null;
                setIsLoading(false);
                console.log("UserContext: Пользователь вышел, isLoading:", false);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
            if (fetchTimeout.current) {
                clearTimeout(fetchTimeout.current);
            }
        };
    }, []);

    return (
        <UserContext.Provider value={{ user, isLoading, isBanned: user?.isBanned || false, updateUserStatus }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);