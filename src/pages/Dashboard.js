import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useUser } from './UserContext';
import './Dashboard.css';

function Dashboard() {
    const { user } = useUser(); // Используем useUser вместо пропсов
    const [stats, setStats] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(false);

    const formatNumber = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            if (!user?.id) {
                console.warn('Dashboard: Пользователь не авторизован.');
                return;
            }

            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id', { count: 'exact' });
            if (usersError) throw usersError;

            const { data: completedOrdersData, error: completedOrdersError } = await supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('status', 'Одобрено');
            if (completedOrdersError) throw completedOrdersError;

            const { data: allOrdersData, error: allOrdersError } = await supabase
                .from('orders')
                .select('id', { count: 'exact' });
            if (allOrdersError) throw allOrdersError;

            const { data: revenueData, error: revenueError } = await supabase
                .from('orders')
                .select('amount')
                .eq('status', 'Одобрено');
            if (revenueError) throw revenueError;
            const totalRevenue = revenueData.reduce((sum, order) => sum + order.amount, 0);

            const newStats = [
                { id: 1, title: 'Пользователи', count: usersData.length, trend: '+12%' },
                { id: 2, title: 'Сдали', count: completedOrdersData.length, trend: '+5%' },
                { id: 3, title: 'Продано', count: allOrdersData.length, trend: '+8%' },
                { id: 4, title: 'Доход', count: `${formatNumber(totalRevenue)} UZS`, trend: '+15%' },
            ];
            setStats(newStats);

            const { data: logsData, error: logsError } = await supabase
                .from('logs')
                .select('timestamp, message')
                .order('timestamp', { ascending: false })
                .limit(3);
            if (logsError) throw logsError;

            setRecentActivity(
                logsData.map((log) => ({
                    time: new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    description: log.message,
                }))
            );
        } catch (error) {
            console.error('Ошибка загрузки данных дашборда:', error.message);
        } finally {
            setLoading(false);
        }
    }, [user]); // Зависимость от user

    useEffect(() => {
        if (user?.id) {
            fetchDashboardData();

            const logsSubscription = supabase
                .channel('logs-channel')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
                    const newLog = {
                        time: new Date(payload.new.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        description: payload.new.message,
                    };
                    setRecentActivity((prev) => [newLog, ...prev.slice(0, 2)]);
                })
                .subscribe();

            return () => supabase.removeChannel(logsSubscription);
        }
    }, [user, fetchDashboardData]); // Добавлена fetchDashboardData

    return (
        <div className="dashboard">
            <h2>Дашборд</h2>
            {loading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <div className="stats-container">
                {stats.map((stat) => (
                    <div className="stat-card" key={stat.id}>
                        <div className="stat-title">{stat.title}</div>
                        <div className="stat-count">{stat.count}</div>
                        <div className="stat-trend">{stat.trend}</div>
                    </div>
                ))}
            </div>
            <div className="recent-activity">
                <h3>Последние действия</h3>
                <div className="activity-list">
                    {recentActivity.length === 0 ? (
                        <div className="activity-item">Действия отсутствуют</div>
                    ) : (
                        recentActivity.map((activity, index) => (
                            <div className="activity-item" key={index}>
                                <div className="activity-time">{activity.time}</div>
                                <div className="activity-description">{activity.description}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;