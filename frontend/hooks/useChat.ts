// hooks/useChat.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // useCallback kept for sendMessage
import { useUser } from '../context/UserContext';
import { usePathname } from 'next/navigation';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

type ChatMode = 'messaging' | 'voice' | 'empty-chair';

export const useChat = (modeOverride?: ChatMode) => {
  const { userId } = useUser();
  const pathname = usePathname(); // Đọc URL hiện tại (ví dụ: '/voice')

  // 1. Mode: dùng tham số truyền vào nếu có, nếu không thì suy ra từ URL.
  const mode = useMemo<ChatMode>(() => {
    if (modeOverride) return modeOverride;
    if (pathname.includes('/voice')) return 'voice';
    if (pathname.includes('/empty-chair')) return 'empty-chair';
    return 'messaging'; // Mặc định là nhắn tin
  }, [pathname, modeOverride]);

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

  const [emotion, setEmotion] = useState<string>("Neutral");
  const [status, setStatus] = useState<string>("idle");
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Audio playback via Web Audio API (bypasses autoplay policy when unlocked during user gesture)
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // 3. Thiết lập kết nối WebSocket (only reconnect when userId changes)
  //    + tự động kết nối lại sau 3s nếu rớt mạng (trừ khi component unmount).
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    intentionalCloseRef.current = false;

    const connect = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);
      wsRef.current = ws;

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
        else if (data.type === "audio_chunk") {
          const binary = atob(data.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          audioChunksRef.current.push(bytes);
        }
        else if (data.type === "audio_end") {
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          if (chunks.length === 0) return;
          const totalLength = chunks.reduce((sum, b) => sum + b.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
          const ctx = audioCtxRef.current;
          if (ctx) {
            ctx.decodeAudioData(combined.buffer as ArrayBuffer, (buffer) => {
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(0);
            }, (e) => console.error('Audio decode failed:', e));
          }
        }
        else if (data.type === "emotion_status") {
          setEmotion(data.emotion);
        }
        else if (data.type === "status") {
          setStatus(data.content);
        }
      };

      ws.onopen = () => console.log("SoulMate Socket Connected");
      ws.onclose = () => {
        console.log("SoulMate Socket Disconnected");
        // Auto-reconnect after 3s — unless this was an intentional unmount, or a
        // newer socket has already replaced this one (avoids stale reconnects).
        if (!intentionalCloseRef.current && wsRef.current === ws) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      setSocket(ws);
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
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
    status,
    socket,
    unlockAudio,
  };
};
