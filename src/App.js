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
    // Восстановить currentPage из localStorage
    const savedPage = localStorage.getItem("currentPage");
    return savedPage || null;
  });

  // Сохранять currentPage в localStorage при его изменении
  useEffect(() => {
    if (currentPage) {
      localStorage.setItem("currentPage", currentPage);
      console.log("App.js: Saved currentPage to localStorage:", currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    console.log("App.js: useEffect triggered, isLoading =", isLoading, "user =", user, "isBanned =", isBanned);
    if (!isLoading && user && !isBanned && user.status !== "Онлайн") {
      console.log("App.js: Setting initial page and updating status");
      // Установить начальную страницу, только если не восстановлена из localStorage
      if (!currentPage) {
        const initialPage = user.role === "Администратор" ? "dashboard" : "assistant";
        setCurrentPage(initialPage);
      }
      updateUserStatus("Онлайн", user.id);
    }
  }, [user, isBanned, isLoading, updateUserStatus, currentPage]);

  const handleLogin = async (userData) => {
    console.log("App.js: handleLogin called with userData =", userData);
    await updateUserStatus("Онлайн", userData.id);
    const initialPage = userData.role === "Администратор" ? "dashboard" : "assistant";
    setCurrentPage(initialPage);
  };

  const handleLogout = async () => {
    console.log("App.js: handleLogout called");
    if (user?.id) {
      await updateUserStatus("Оффлайн", user.id);
    }
    await supabase.auth.signOut();
    setCurrentPage(null);
    localStorage.removeItem("currentPage"); // Очистить при выходе
  };

  if (isLoading) {
    console.log("App.js: Rendering loader due to isLoading = true");
    return (
      <div className="loader-overlay">
        <div className="loader"></div>
      </div>
    );
  }

  if (isBanned) {
    console.log("App.js: Rendering banned screen");
    return (
      <div className="banned-screen">
        <h2>Ваш аккаунт заблокирован</h2>
        <p>Для выяснения причин обратитесь к администратору</p>
      </div>
    );
  }

  if (!user) {
    console.log("App.js: Rendering Login page");
    return <Login onLogin={handleLogin} />;
  }

  console.log("App.js: Rendering admin panel with currentPage =", currentPage);
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