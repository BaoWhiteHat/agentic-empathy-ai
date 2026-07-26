// hooks/useChat.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // useCallback kept for sendMessage
import { useUser } from '../context/UserContext';
import { usePathname } from 'next/navigation';

export interface Message {
  role: 'user' | 'ai';
  content: string;
  stream?: boolean;
}

type ChatMode = 'messaging' | 'voice' | 'empty-chair';
type ChatHistories = Record<ChatMode, Message[]>;
type PersistedMode = 'messaging' | 'empty-chair';

const HISTORY_VERSION = 1;
const HISTORY_LIMIT = 100;
const PERSISTED_MODES: PersistedMode[] = ['messaging', 'empty-chair'];

const storageKeyFor = (userId: string) => `soulmate_chat_history_v${HISTORY_VERSION}_${userId}`;

const emptyHistories = (): ChatHistories => ({
  messaging: [],
  voice: [],
  'empty-chair': [],
});

const isChatMode = (mode: unknown): mode is ChatMode =>
  mode === 'messaging' || mode === 'voice' || mode === 'empty-chair';

const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Message>;
  return (candidate.role === 'user' || candidate.role === 'ai') && typeof candidate.content === 'string';
};

const cleanMessages = (messages: unknown): Message[] => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(isMessage)
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-HISTORY_LIMIT);
};

const appendMessage = (histories: ChatHistories, mode: ChatMode, message: Message): ChatHistories => ({
  ...histories,
  [mode]: [...histories[mode], message].slice(-HISTORY_LIMIT),
});

const readStoredHistories = (userId: string): ChatHistories => {
  const histories = emptyHistories();
  if (typeof localStorage === 'undefined') return histories;
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (!raw) return histories;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== HISTORY_VERSION) {
      return histories;
    }
    const stored = (parsed as { histories?: Record<string, unknown> }).histories;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return histories;
    for (const mode of PERSISTED_MODES) {
      histories[mode] = cleanMessages(stored[mode]);
    }
  } catch {
    return histories;
  }
  return histories;
};

const writeStoredHistories = (userId: string, histories: ChatHistories) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify({
      version: HISTORY_VERSION,
      histories: {
        messaging: cleanMessages(histories.messaging),
        'empty-chair': cleanMessages(histories['empty-chair']),
      },
    }));
  } catch { /* ignore quota/private-mode storage failures */ }
};

export const clearStoredChatHistory = (userId: string) => {
  if (typeof localStorage === 'undefined' || !userId) return;
  try { localStorage.removeItem(storageKeyFor(userId)); } catch { /* ignore */ }
};

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
  const [chatHistories, setChatHistories] = useState<ChatHistories>(emptyHistories);

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
  const hydratedUserRef = useRef<string | null>(null);
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      hydratedUserRef.current = null;
      skipNextPersistRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cached UI history when the user logs out
      setChatHistories(emptyHistories());
      return;
    }
    const stored = readStoredHistories(userId);
    hydratedUserRef.current = userId;
    skipNextPersistRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate visible chat history from localStorage after user context is known
    setChatHistories(stored);
  }, [userId]);

  useEffect(() => {
    if (!userId || hydratedUserRef.current !== userId) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeStoredHistories(userId, chatHistories);
  }, [userId, chatHistories]);

  useEffect(() => {
    if (!userId) return;
    intentionalCloseRef.current = false;

    const connect = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "message") {
          const targetMode = isChatMode(data.mode) ? data.mode : "messaging";
          setChatHistories(prev => appendMessage(prev, targetMode, { role: "ai", content: data.content, stream: true }));
        }
        else if (data.type === "user_speech") {
          // Voice transcription — use the mode from the server response
          const targetMode = isChatMode(data.mode) ? data.mode : "voice";
          setChatHistories(prev => appendMessage(prev, targetMode, { role: "user", content: data.content }));
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

      setChatHistories(prev => appendMessage(prev, mode, { role: "user", content: text }));
    }
  }, [socket, mode]);

  const resetSession = useCallback(() => {
    setChatHistories((prev) => ({ ...prev, [mode]: [] }));
    setEmotion('Neutral');
    setStatus('idle');
    audioChunksRef.current = [];
  }, [mode]);

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
    resetSession,
  };
};
