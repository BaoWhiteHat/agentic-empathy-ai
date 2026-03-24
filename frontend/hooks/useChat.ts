// hooks/useChat.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { usePathname } from 'next/navigation'; // 💡 Thêm Hook này của Next.js

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const useChat = () => {
  const { userId } = useUser();
  const pathname = usePathname(); // Đọc URL hiện tại (ví dụ: '/voice')

  // 1. Tự động nhận diện Mode dựa vào thanh địa chỉ URL
  const mode = useMemo(() => {
    if (pathname.includes('/voice')) return 'voice';
    if (pathname.includes('/empty-chair')) return 'empty-chair';
    return 'messaging'; // Mặc định là nhắn tin
  }, [pathname]);

  // 2. Khởi tạo kho lưu trữ tin nhắn
  const [chatHistories, setChatHistories] = useState<{
    messaging: Message[];
    voice: Message[];
    'empty-chair': Message[];
  }>({
    messaging: [],
    voice: [],
    'empty-chair': []
  });

  const [emotion, setEmotion] = useState<string>("Bình thường");
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // 3. Thiết lập kết nối WebSocket (only reconnect when userId changes)
  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "message") {
        const targetMode = data.mode || "messaging";
        setChatHistories(prev => ({
          ...prev,
          [targetMode]: [...prev[targetMode as keyof typeof prev], { role: "ai", content: data.content }]
        }));
      }
      else if (data.type === "user_speech") {
        // Voice transcription — use the mode from the server response
        const targetMode = data.mode || "voice";
        setChatHistories(prev => ({
          ...prev,
          [targetMode]: [...prev[targetMode as keyof typeof prev], { role: "user", content: data.content }]
        }));
      }
      else if (data.type === "emotion_status") {
        setEmotion(data.emotion);
      }
    };

    ws.onopen = () => console.log("SoulMate Socket Connected");
    ws.onclose = () => console.log("SoulMate Socket Disconnected");

    setSocket(ws);
    return () => ws.close();
  }, [userId]);

  // 4. Hàm gửi tin nhắn
  const sendMessage = useCallback((text: string) => {
    if (socket && text.trim()) {
      socket.send(JSON.stringify({ 
        action: "send_text",
        text: text, 
        mode: mode 
      }));
      
      setChatHistories(prev => ({
        ...prev,
        [mode]: [...prev[mode as keyof typeof prev], { role: "user", content: text }]
      }));
    }
  }, [socket, mode]);

  // 5. Lọc lấy tin nhắn của mode hiện tại để trả về cho giao diện
  const currentMessages = useMemo(() => {
    return chatHistories[mode as keyof typeof chatHistories] || [];
  }, [chatHistories, mode]);

  return { 
    messages: currentMessages, 
    sendMessage, 
    emotion, 
    socket 
  };
};