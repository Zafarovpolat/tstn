import React, { useState, useEffect } from "react";
import { useUser } from "./pages/UserContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Assistant from "./pages/Assistant";
import { supabase } from "./pages/supabaseClient";
import "./App.css";

function App() {
  const { user, isLoading, isBanned, updateUserStatus } = useUser();
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem("currentPage");
    console.log("App.js: Инициализация currentPage из localStorage:", savedPage);
    return savedPage || null;
  });

  useEffect(() => {
    console.log("App.js: useEffect для сохранения currentPage, currentPage:", currentPage);
    if (currentPage) {
      localStorage.setItem("currentPage", currentPage);
      console.log("App.js: Сохранено currentPage в localStorage:", currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    console.log("App.js: useEffect для инициализации страницы и статуса, isLoading:", isLoading, "user:", user, "isBanned:", isBanned);
    if (!isLoading && user && !isBanned && user.status !== "Онлайн") {
      console.log("App.js: Установка начальной страницы и обновление статуса");
      if (!currentPage) {
        const initialPage = user.role === "Администратор" ? "dashboard" : "assistant";
        setCurrentPage(initialPage);
        console.log("App.js: Установлена начальная страница:", initialPage);
      }
      console.log("App.js: Вызов updateUserStatus для статуса Онлайн");
      updateUserStatus("Онлайн", user.id);
    }
  }, [user, isBanned, isLoading, updateUserStatus, currentPage]);

  const handleLogin = async (userData) => {
    console.log("App.js: handleLogin: Начало выполнения, userData:", userData);
    await updateUserStatus("Онлайн", userData.id);
    const initialPage = userData.role === "Администратор" ? "dashboard" : "assistant";
    setCurrentPage(initialPage);
    console.log("App.js: handleLogin: Установлена страница после логина:", initialPage);
  };

  const handleLogout = async () => {
    console.log("App.js: handleLogout: Начало выполнения");
    if (user?.id) {
      console.log("App.js: handleLogout: Обновление статуса на Оффлайн для user.id:", user.id);
      await updateUserStatus("Оффлайн", user.id);
    }
    console.log("App.js: handleLogout: Вызов supabase.auth.signOut");
    await supabase.auth.signOut();
    setCurrentPage(null);
    localStorage.removeItem("currentPage");
    console.log("App.js: handleLogout: Установлено currentPage=null, удалено из localStorage");
  };

  console.log("App.js: Рендеринг, isLoading:", isLoading, "isBanned:", isBanned, "user:", user, "currentPage:", currentPage);
  if (isLoading) {
    console.log("App.js: Рендеринг loader из-за isLoading=true");
    return (
      <div className="loader-overlay">
        <div className="loader"></div>
      </div>
    );
  }

  if (isBanned) {
    console.log("App.js: Рендеринг banned-screen из-за isBanned=true");
    return (
      <div className="banned-screen">
        <h2>Ваш аккаунт заблокирован</h2>
        <p>Для выяснения причин обратитесь к администратору</p>
      </div>
    );
  }

  if (!user) {
    console.log("App.js: Рендеринг страницы Login из-за user=null");
    return <Login onLogin={handleLogin} />;
  }

  console.log("App.js: Рендеринг admin-panel, currentPage:", currentPage);
  return (
    <div className="admin-panel">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout} />
      <main className="content">
        {currentPage === "dashboard" && <Dashboard />}
        {currentPage === "users" && <UserManagement />}
        {currentPage === "products" && <Products />}
        {currentPage === "orders" && <Orders />}
        {currentPage === "logs" && <Logs />}
        {currentPage === "settings" && <Settings />}
        {currentPage === "assistant" && <Assistant />}
      </main>
    </div>
  );
}

export default App;