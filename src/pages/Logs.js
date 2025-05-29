import React, { useState, useEffect } from "react";
import { supabase } from "../pages/supabaseClient";
import { useUser } from "../pages/UserContext";
import "./Logs.css";

function Logs() {
    const { user } = useUser();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const formatDateTime = (date) => {
        return new Date(date).toLocaleString("ru-RU", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("logs")
                .select("*")
                .order("timestamp", { ascending: false })
                .limit(50);
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Ошибка загрузки логов:", error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();

        const logsSubscription = supabase
            .channel("logs-channel")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs" }, (payload) => {
                setLogs((prev) => [payload.new, ...prev.slice(0, 49)]);
            })
            .subscribe();

        return () => supabase.removeChannel(logsSubscription);
    }, []);

    if (!user) return null;

    return (
        <div className="logs">
            <h1>Логи</h1>
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <ul className="logs-list">
                {logs.length === 0 ? (
                    <li className="logs-item">Логи отсутствуют</li>
                ) : (
                    logs.map((log) => (
                        <li key={log.id} className="logs-item">
                            <span className="log-timestamp">{formatDateTime(log.timestamp)}</span> - {log.message}
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}

export default Logs;