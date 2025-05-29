import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "../pages/UserContext";
import "./Assistant.css";

function Assistant() {
    const { user } = useUser();
    const [clientsData, setClientsData] = useState({});
    const [timers, setTimers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    const loaderTimeoutRef = useRef(null);

    const updateClientsData = useCallback((data) => {
        if (data.type === "initialState") {
            data.exams.forEach((exam) => {
                exam.questions.forEach((question) => {
                    renderExam({
                        clientId: exam.clientId,
                        userInfo: exam.userInfo,
                        question: question.question,
                        questionImg: question.questionImg,
                        qIndex: question.qIndex,
                        answers: question.answers,
                        timer: exam.timer,
                    });
                });
            });
            return;
        }

        if (data.type === "clientDisconnected") {
            removeClient(data.clientId);
            return;
        }

        if (data.clientId && data.userInfo && (data.question || data.questionImg) && data.answers) {
            renderExam(data);
            if (data.timer && clientsData[data.clientId]?.timer !== data.timer) {
                setClientsData((prev) => ({
                    ...prev,
                    [data.clientId]: {
                        ...prev[data.clientId],
                        timer: data.timer,
                    },
                }));
                if (!timers[data.clientId]) {
                    let timeInSeconds = timeToSeconds(data.timer);
                    setTimeout(() => {
                        setTimers((prevTimers) => {
                            if (prevTimers[data.clientId]) return prevTimers;
                            const interval = setInterval(() => {
                                setClientsData((prevClients) => {
                                    if (!prevClients[data.clientId]) {
                                        clearInterval(interval);
                                        return prevClients;
                                    }
                                    if (timeInSeconds > 0) {
                                        timeInSeconds--;
                                        return {
                                            ...prevClients,
                                            [data.clientId]: {
                                                ...prevClients[data.clientId],
                                                timer: secondsToTime(timeInSeconds),
                                            },
                                        };
                                    } else {
                                        clearInterval(interval);
                                        setTimers((prevTimers) => {
                                            const newTimers = { ...prevTimers };
                                            delete newTimers[data.clientId];
                                            return newTimers;
                                        });
                                        return prevClients;
                                    }
                                });
                            }, 1000);
                            return { ...prevTimers, [data.clientId]: interval };
                        });
                    }, 2000);
                }
            }
        }
    }, [clientsData, timers]);

    const connectWebSocket = useCallback(() => {
        console.log("Попытка подключения WebSocket...");
        const ws = new WebSocket("wss://x-q63z.onrender.com");
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket подключен на сайте-помощнике");
            ws.send(JSON.stringify({ role: "exam" }));
            reconnectAttempts.current = 0;
            clearTimeout(loaderTimeoutRef.current);
            setIsLoading(false);
            setError(null);
        };

        ws.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
                console.log("Получены данные от сервера:", data);
                updateClientsData(data);
            } catch (e) {
                console.error("Ошибка парсинга JSON:", e);
                setError("Ошибка обработки данных с сервера");
            }
        };

        ws.onerror = () => {
            console.error("Ошибка WebSocket");
            setError("Ошибка подключения к серверу");
            setIsLoading(false);
        };

        ws.onclose = () => {
            console.log("WebSocket закрыт");
            clearTimeout(loaderTimeoutRef.current);
            loaderTimeoutRef.current = setTimeout(() => {
                setIsLoading(true);
            }, 500);

            if (reconnectAttempts.current < maxReconnectAttempts) {
                reconnectAttempts.current++;
                console.log(`Попытка переподключения ${reconnectAttempts.current}/${maxReconnectAttempts} через ${reconnectDelay} мс...`);
                setTimeout(connectWebSocket, reconnectDelay);
            } else {
                console.error("Достигнуто максимальное количество попыток переподключения");
                setError("Не удалось подключиться к серверу после нескольких попыток");
                clearTimeout(loaderTimeoutRef.current);
                setIsLoading(false);
            }
        };
    }, []); // Убрали clientsData из зависимостей

    useEffect(() => {
        connectWebSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            Object.values(timers).forEach((interval) => clearInterval(interval));
            setTimers({});
            clearTimeout(loaderTimeoutRef.current);
        };
    }, [connectWebSocket]);

    const timeToSeconds = useCallback((timeStr) => {
        const [hours, minutes, seconds] = timeStr.split(":").map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }, []);

    const secondsToTime = useCallback((seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }, []);

    const renderExam = useCallback(
        (data) => {
            const { clientId, userInfo, question, questionImg, qIndex, answers, timer } = data;

            setClientsData((prev) => {
                const newData = { ...prev };

                if (!newData[clientId]) {
                    newData[clientId] = {
                        userInfo,
                        questions: [],
                        timer: timer || "00:00:00",
                        showQuestions: false,
                    };

                    let timeInSeconds = timeToSeconds(newData[clientId].timer);
                    if (!timers[clientId]) {
                        setTimeout(() => {
                            setTimers((prevTimers) => {
                                if (prevTimers[clientId]) return prevTimers;
                                const interval = setInterval(() => {
                                    setClientsData((prevClients) => {
                                        if (!prevClients[clientId]) {
                                            clearInterval(interval);
                                            return prevClients;
                                        }
                                        if (timeInSeconds > 0) {
                                            timeInSeconds--;
                                            return {
                                                ...prevClients,
                                                [clientId]: {
                                                    ...prevClients[clientId],
                                                    timer: secondsToTime(timeInSeconds),
                                                },
                                            };
                                        } else {
                                            clearInterval(interval);
                                            setTimers((prevTimers) => {
                                                const newTimers = { ...prevTimers };
                                                delete newTimers[clientId];
                                                return newTimers;
                                            });
                                            return prevClients;
                                        }
                                    });
                                }, 1000);
                                return { ...prevTimers, [clientId]: interval };
                            });
                        }, 2000);
                    }
                }

                const uniqueId = `${clientId}-${qIndex}`;
                if (!newData[clientId].questions.some((q) => q.uniqueId === uniqueId)) {
                    newData[clientId].questions.push({
                        uniqueId,
                        qIndex,
                        question,
                        questionImg,
                        answers,
                    });
                }

                return newData;
            });
        },
        [timers, timeToSeconds, secondsToTime]
    );

    const removeClient = useCallback((clientId) => {
        setClientsData((prev) => {
            const newData = { ...prev };
            delete newData[clientId];
            return newData;
        });
        setTimers((prev) => {
            if (prev[clientId]) {
                clearInterval(prev[clientId]);
                const newTimers = { ...prev };
                delete newTimers[clientId];
                return newTimers;
            }
            return prev;
        });
        console.log(`Клиент ${clientId} удалён из интерфейса`);
    }, []);

    const handleToggleQuestions = useCallback((clientId) => {
        setClientsData((prev) => {
            if (!prev[clientId]) return prev;
            return {
                ...prev,
                [clientId]: {
                    ...prev[clientId],
                    showQuestions: !prev[clientId].showQuestions,
                },
            };
        });
    }, []);

    const handleAnswerChange = useCallback(
        (clientId, qIndex, question, answer, varIndex) => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                console.error("WebSocket не подключен");
                setError("WebSocket не подключен, невозможно отправить ответ");
                return;
            }
            const response = JSON.stringify({
                qIndex,
                question,
                answer,
                varIndex,
                clientId,
            });
            console.log("Отправка ответа в helper:", response);
            socketRef.current.send(response);
        },
        []
    );

    if (!user) return null;

    if (error) {
        return (
            <div className="assistant">
                <h2>Помощник для экзамена</h2>
                <p style={{ color: "#BAC4D1", textAlign: "center" }}>{error}</p>
            </div>
        );
    }

    return (
        <div className="assistant">
            {isLoading && (
                <div className="loader-overlay">
                    <div className="loader"></div>
                </div>
            )}
            <h2>Помощник для экзамена</h2>
            <div id="clients">
                {Object.entries(clientsData).map(([clientId, client]) => (
                    <div key={clientId} className="client-section" data-client-id={clientId}>
                        <div className="client-header">
                            <button onClick={() => handleToggleQuestions(clientId)}>
                                <span className="client-info">{client?.userInfo || "Неизвестный пользователь"}</span>
                                <span className="client-timer">{client?.timer || "00:00:00"}</span>
                            </button>
                        </div>
                        <div className="questions" style={{ display: client?.showQuestions ? "block" : "none" }}>
                            <div className="questions-scroll">
                                {(client?.questions || []).map((q) => (
                                    <div key={q?.uniqueId} className="question" data-unique-id={q?.uniqueId}>
                                        {q?.question && (
                                            <p>
                                                <strong>{(q?.qIndex || 0) + 1}. {q.question}</strong>
                                            </p>
                                        )}
                                        {q?.questionImg && <img src={q.questionImg} alt="Question" />}
                                        <ul>
                                            {(q?.answers || []).map((answer, varIndex) => (
                                                <li key={varIndex}>
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name={`question-${q?.uniqueId}`}
                                                            value={answer?.text || ""}
                                                            onChange={() =>
                                                                handleAnswerChange(clientId, q?.qIndex, q?.question, answer?.text || "", varIndex)
                                                            }
                                                        />
                                                        {answer?.text && ` ${answer.text}`}
                                                        {answer?.img && <img src={answer.img} className="answer-img" alt="Answer" />}
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Assistant;