import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "../pages/UserContext";
import "./Assistant.css";

function Assistant() {
    const { user } = useUser();
    const [clientsData, setClientsData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    const loaderTimeoutRef = useRef(null);

    const updateClientsData = useCallback((data) => {
        console.log("Assistant.js: updateClientsData received data:", data);
        setClientsData((prev) => {
            const newData = { ...prev };

            if (data.type === "initialState") {
                console.log("Assistant.js: Processing initialState with exams:", data.exams);
                data.exams.forEach((exam) => {
                    if (!newData[exam.clientId]) {
                        newData[exam.clientId] = {
                            userInfo: exam.userInfo,
                            questions: [],
                            timer: exam.timer || "00:00:00",
                            showQuestions: false,
                        };
                    } else {
                        newData[exam.clientId].showQuestions = newData[exam.clientId].showQuestions || false;
                    }
                    exam.questions.forEach((question) => {
                        const uniqueId = `${exam.clientId}-${question.qIndex}`;
                        if (!newData[exam.clientId].questions.some((q) => q.uniqueId === uniqueId)) {
                            newData[exam.clientId].questions.push({
                                uniqueId,
                                qIndex: question.qIndex,
                                question: question.question,
                                questionImg: question.questionImg,
                                answers: question.answers,
                                answersList: question.answersList || [],
                            });
                        }
                    });
                });
                return newData;
            }

            if (data.type === "clientDisconnected") {
                console.log("Assistant.js: Client disconnected, clientId:", data.clientId);
                delete newData[data.clientId];
                return newData;
            }

            if (data.type === "timerUpdate" && data.clientId && data.timer) {
                console.log("Assistant.js: Timer update for clientId:", data.clientId, "timer:", data.timer);
                if (newData[data.clientId]) {
                    newData[data.clientId].timer = data.timer;
                }
                return newData;
            }

            if (data.type === "processedAnswer" && data.clientId && data.answer) {
                console.log("Assistant.js: Received processedAnswer:", {
                    clientId: data.clientId,
                    qIndex: data.qIndex,
                    answer: data.answer,
                    answeredBy: data.answeredBy,
                });
                if (!newData[data.clientId]) {
                    console.warn("Assistant.js: Creating new client data for:", data.clientId);
                    newData[data.clientId] = {
                        userInfo: "Неизвестный пользователь",
                        questions: [],
                        timer: "00:00:00",
                        showQuestions: false,
                    };
                }
                const uniqueId = `${data.clientId}-${data.qIndex}`;
                let question = newData[data.clientId].questions.find((q) => q.qIndex === data.qIndex);
                if (!question) {
                    console.log("Assistant.js: Adding new question for processedAnswer:", data.qIndex);
                    question = {
                        uniqueId,
                        qIndex: data.qIndex,
                        question: data.question,
                        questionImg: null,
                        answers: [],
                        answersList: [{ answer: data.answer, answeredBy: data.answeredBy }],
                    };
                    newData[data.clientId].questions.push(question);
                } else {
                    if (!question.answersList) question.answersList = [];
                    if (!question.answersList.some((a) => a.answeredBy === data.answeredBy)) {
                        question.answersList.push({ answer: data.answer, answeredBy: data.answeredBy });
                    } else {
                        question.answersList = question.answersList.map((a) =>
                            a.answeredBy === data.answeredBy ? { answer: data.answer, answeredBy: data.answeredBy } : a
                        );
                    }
                }
                return newData;
            }

            if (data.clientId && data.userInfo && (data.question || data.questionImg) && data.answers) {
                console.log("Assistant.js: Rendering new exam data:", data);
                if (!newData[data.clientId]) {
                    newData[data.clientId] = {
                        userInfo: data.userInfo,
                        questions: [],
                        timer: data.timer || "00:00:00",
                        showQuestions: false,
                    };
                } else {
                    newData[data.clientId].showQuestions = newData[data.clientId].showQuestions || false;
                }
                const uniqueId = `${data.clientId}-${data.qIndex}`;
                if (!newData[data.clientId].questions.some((q) => q.uniqueId === uniqueId)) {
                    newData[data.clientId].questions.push({
                        uniqueId,
                        qIndex: data.qIndex,
                        question: data.question,
                        questionImg: data.questionImg,
                        answers: data.answers,
                        answersList: [],
                    });
                }
                if (data.timer) {
                    newData[data.clientId].timer = data.timer;
                }
                return newData;
            }

            return newData;
        });
    }, []);

    const connectWebSocket = useCallback(() => {
        console.log("Assistant.js: Attempting WebSocket connection...");
        const ws = new WebSocket("wss://x-q63z.onrender.com");
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("Assistant.js: WebSocket connected");
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
                console.log("Assistant.js: Received WebSocket message:", data);
                updateClientsData(data);
            } catch (e) {
                console.error("Assistant.js: JSON parse error:", e);
                setError("Ошибка обработки данных с сервера");
            }
        };

        ws.onerror = () => {
            console.error("Assistant.js: WebSocket error");
            setError("Ошибка подключения к серверу");
            setIsLoading(false);
        };

        ws.onclose = () => {
            console.log("Assistant.js: WebSocket closed");
            clearTimeout(loaderTimeoutRef.current);
            loaderTimeoutRef.current = setTimeout(() => {
                setIsLoading(true);
            }, 500);

            if (reconnectAttempts.current < maxReconnectAttempts) {
                reconnectAttempts.current++;
                console.log(`Assistant.js: Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
                setTimeout(connectWebSocket, reconnectDelay);
            } else {
                console.error("Assistant.js: Max reconnect attempts reached");
                setError("Не удалось подключиться к серверу после нескольких попыток");
                clearTimeout(loaderTimeoutRef.current);
                setIsLoading(false);
            }
        };
    }, []);

    useEffect(() => {
        connectWebSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            clearTimeout(loaderTimeoutRef.current);
        };
    }, [connectWebSocket]);

    const handleToggleQuestions = useCallback((clientId) => {
        console.log("Assistant.js: handleToggleQuestions called for clientId:", clientId);
        setClientsData((prev) => {
            if (!prev[clientId]) {
                console.warn("Assistant.js: Client not found for clientId:", clientId);
                return prev;
            }
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
                console.error("Assistant.js: WebSocket not connected");
                setError("WebSocket не подключен, невозможно отправить ответ");
                return;
            }
            const response = JSON.stringify({
                qIndex,
                question,
                answer,
                varIndex,
                clientId,
                answeredBy: user.email || user.id,
            });
            console.log("Assistant.js: Sending answer to helper:", response);
            socketRef.current.send(response);
        },
        [user]
    );

    if (!user) {
        console.log("Assistant.js: No user, rendering null");
        return null;
    }

    if (error) {
        console.log("Assistant.js: Rendering error:", error);
        return (
            <div className="assistant">
                <h2>Помощник для экзамена</h2>
                <p style={{ color: "#BAC4D1", textAlign: "center" }}>{error}</p>
            </div>
        );
    }

    console.log("Assistant.js: Rendering with clientsData:", clientsData);
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
                            <button
                                onClick={() => handleToggleQuestions(clientId)}
                                aria-expanded={client?.showQuestions}
                                aria-controls={`questions-${clientId}`}
                            >
                                <span className="client-info">{client?.userInfo || "Неизвестный пользователь"}</span>
                                <span className="client-timer">{client?.timer || "00:00:00"}</span>
                            </button>
                        </div>
                        <div
                            id={`questions-${clientId}`}
                            className="questions"
                            style={{ display: client?.showQuestions ? "block" : "none" }}
                        >
                            <div className="questions-scroll">
                                {(client?.questions || []).map((q) => (
                                    <div key={q?.uniqueId} className="question" data-unique-id={q?.uniqueId}>
                                        {q?.question && (
                                            <p>
                                                <strong>{(q?.qIndex || 0) + 1}. {q.question}</strong>
                                            </p>
                                        )}
                                        {q?.questionImg && <img src={q.questionImg} alt="Question" />}
                                        {(q?.answersList || []).map((ans, index) => (
                                            <p key={index} className="answered-info">
                                                Ответил: {ans.answeredBy} — {ans.answer}
                                            </p>
                                        ))}
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