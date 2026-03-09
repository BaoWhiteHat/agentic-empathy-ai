import { useState, useEffect, useCallback } from 'react';

export const useChat = (userId: string) => {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [emotion, setEmotion] = useState<string>("Bình thường");

  useEffect(() => {
    // Kết nối tới Backend FastAPI của cậu
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages(prev => [...prev, { role: "ai", content: data.content }]);
      } else if (data.type === "emotion_status") {
        setEmotion(data.emotion);
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, [userId]);

  const sendMessage = useCallback((text: string, mode = "soulmate", useVoice = false) => {
    if (socket && text) {
      const payload = { text, mode, use_voice: useVoice, target_name: "User" };
      socket.send(JSON.stringify(payload));
      setMessages(prev => [...prev, { role: "user", content: text }]);
    }
  }, [socket]);

  return { messages, sendMessage, emotion };
};