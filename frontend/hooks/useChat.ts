import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useMode } from '../app/layout'; // Lấy mode hiện tại từ Context

// Định nghĩa kiểu dữ liệu tin nhắn
interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const useChat = () => {
  const { userId } = useUser();
  const { mode } = useMode();
  
  // 1. Lưu trữ 3 kho lịch sử riêng biệt
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

  // 2. Thiết lập kết nối WebSocket
  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Xử lý tin nhắn từ AI gửi về
      if (data.type === "message") {
        const targetMode = data.mode || 'messaging';
        setChatHistories(prev => ({
          ...prev,
          [targetMode]: [...prev[targetMode as keyof typeof prev], { role: "ai", content: data.content }]
        }));
      } 
      
      // Xử lý khi AI nghe xong giọng nói của cậu và chuyển thành chữ (STT)
      else if (data.type === "user_speech") {
        setChatHistories(prev => ({
          ...prev,
          voice: [...prev.voice, { role: "user", content: data.content }]
        }));
      }

      // Cập nhật cảm xúc từ Perception Agent
      else if (data.type === "emotion_status") {
        setEmotion(data.emotion);
      }
    };

    ws.onopen = () => console.log("✅ SoulMate Socket Connected");
    ws.onclose = () => console.log("❌ SoulMate Socket Disconnected");

    setSocket(ws);
    return () => ws.close();
  }, [userId]);

  // 3. Hàm gửi tin nhắn
  const sendMessage = useCallback((text: string) => {
    if (socket && text.trim()) {
      // Gửi lên Backend kèm mode hiện tại
      socket.send(JSON.stringify({ 
        action: "send_text",
        text: text, 
        mode: mode 
      }));
      
      // Cập nhật ngay lập tức vào giao diện người dùng theo mode đang đứng
      setChatHistories(prev => ({
        ...prev,
        [mode]: [...prev[mode as keyof typeof prev], { role: "user", content: text }]
      }));
    }
  }, [socket, mode]);

  // 4. Lọc lấy tin nhắn của mode hiện tại để page.tsx hiển thị
  const currentMessages = useMemo(() => {
    return chatHistories[mode as keyof typeof chatHistories] || [];
  }, [chatHistories, mode]);

  return { 
    messages: currentMessages, 
    sendMessage, 
    emotion, 
    socket // Xuất socket ra để page.tsx lắng nghe status
  };
};