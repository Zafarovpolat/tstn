import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const lastUserId = useRef(null); // Кэшируем ID последнего пользователя
    const fetchTimeout = useRef(null); // Для дебаунсинга

    const fetchUser = async () => {
        console.log("UserContext: fetchUser: Начало выполнения");
        const startTime = Date.now();
        try {
            console.log("UserContext: fetchUser: Запрашиваем пользователя из Supabase...");
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            console.log(`UserContext: fetchUser: getUser завершён за ${Date.now() - startTime} мс, authUser:`, authUser);

            if (authError) {
                console.error("UserContext: fetchUser: Ошибка Supabase auth:", authError.message);
                setUser(null);
                setIsLoading(false);
                console.log("UserContext: fetchUser: Установлено isLoading=false, user=null из-за ошибки");
                return false;
            }

            if (authUser) {
                console.log("UserContext: fetchUser: Пользователь авторизован, ID:", authUser.id);
                // Проверяем, не тот ли это пользователь
                if (lastUserId.current === authUser.id) {
                    console.log("UserContext: fetchUser: Пользователь не изменился, пропускаем запрос");
                    setIsLoading(false);
                    console.log("UserContext: fetchUser: Установлено isLoading=false");
                    return true;
                }

                console.log("UserContext: fetchUser: Запрашиваем данные пользователя из таблицы users...");
                const userFetchStart = Date.now();
                const { data: userData, error: userError } = await supabase
                    .from("users")
                    .select("id, role, username, is_banned, status, last_active")
                    .eq("id", authUser.id)
                    .single();
                console.log(`UserContext: fetchUser: Запрос данных пользователя завершён за ${Date.now() - userFetchStart} мс`);

                if (userError) {
                    console.error("UserContext: fetchUser: Ошибка получения данных пользователя:", userError.message);
                    setUser(null);
                    setIsLoading(false);
                    console.log("UserContext: fetchUser: Установлено isLoading=false, user=null из-за ошибки в таблице users");
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
                setIsLoading(false);
                console.log("UserContext: fetchUser: Пользователь успешно загружен:", userInfo, "isLoading=false");
                return true;
            } else {
                console.log("UserContext: fetchUser: Пользователь не авторизован");
                setUser(null);
                lastUserId.current = null;
                setIsLoading(false);
                console.log("UserContext: fetchUser: Установлено isLoading=false, user=null");
                return false;
            }
        } catch (err) {
            console.error("UserContext: fetchUser: Неизвестная ошибка:", err);
            setUser(null);
            lastUserId.current = null;
            setIsLoading(false);
            console.log("UserContext: fetchUser: Установлено isLoading=false, user=null из-за неизвестной ошибки");
            return false;
        } finally {
            console.log(`UserContext: fetchUser: Завершено за ${Date.now() - startTime} мс`);
        }
    };

    const updateUserStatus = async (status, userId) => {
        console.log(`UserContext: updateUserStatus: Начало выполнения, status=${status}, userId=${userId}`);
        try {
            if (!userId) {
                console.error("UserContext: updateUserStatus: userId не предоставлен");
                return false;
            }

            // Проверяем, совпадает ли userId с текущим пользователем
            if (user && user.id !== userId) {
                console.warn(`UserContext: updateUserStatus: userId ${userId} не совпадает с текущим пользователем ${user.id}`);
                return false;
            }

            const updates = {
                status,
                last_active: new Date().toISOString(),
            };
            console.log("UserContext: updateUserStatus: Обновляем статус в Supabase:", updates);

            const updateStart = Date.now();
            const { error } = await supabase
                .from("users")
                .update(updates)
                .eq("id", userId);
            console.log(`UserContext: updateUserStatus: Обновление статуса завершено за ${Date.now() - updateStart} мс`);

            if (error) {
                console.error("UserContext: updateUserStatus: Ошибка обновления статуса:", error.message);
                return false;
            }

            setUser((prev) => {
                const updatedUser = prev ? { ...prev, status, lastActive: new Date().toISOString() } : null;
                console.log("UserContext: updateUserStatus: Обновлено состояние user:", updatedUser);
                return updatedUser;
            });
            console.log(`UserContext: updateUserStatus: Статус пользователя ${userId} успешно обновлён на ${status}`);
            return true;
        } catch (err) {
            console.error("UserContext: updateUserStatus: Ошибка:", err);
            return false;
        }
    };

    useEffect(() => {
        console.log("UserContext: useEffect: Инициализация");
        // Дебаунсинг fetchUser
        const debouncedFetchUser = () => {
            console.log("UserContext: useEffect: Запуск дебаунсинга fetchUser");
            if (fetchTimeout.current) {
                console.log("UserContext: useEffect: Очистка предыдущего таймера");
                clearTimeout(fetchTimeout.current);
            }
            fetchTimeout.current = setTimeout(() => {
                console.log("UserContext: useEffect: Вызов fetchUser после дебаунсинга");
                fetchUser();
            }, 500); // Задержка 500 мс
        };

        debouncedFetchUser();

        console.log("UserContext: useEffect: Установка слушателя auth");
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("UserContext: onAuthStateChange: Событие:", event, "session:", !!session);
            if (event === "SIGNED_IN" && session?.user) {
                console.log("UserContext: onAuthStateChange: Пользователь вошёл, вызываем debouncedFetchUser");
                debouncedFetchUser();
            } else if (event === "SIGNED_OUT") {
                console.log("UserContext: onAuthStateChange: Пользователь вышел");
                setUser(null);
                lastUserId.current = null;
                setIsLoading(false);
                console.log("UserContext: onAuthStateChange: Установлено isLoading=false, user=null");
            }
        });

        return () => {
            console.log("UserContext: useEffect: Очистка слушателя auth и таймера");
            authListener.subscription.unsubscribe();
            if (fetchTimeout.current) {
                clearTimeout(fetchTimeout.current);
            }
        };
    }, []);

    console.log("UserContext: Рендеринг, user:", user, "isLoading:", isLoading);
    return (
        <UserContext.Provider value={{ user, isLoading, isBanned: user?.isBanned || false, updateUserStatus }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);