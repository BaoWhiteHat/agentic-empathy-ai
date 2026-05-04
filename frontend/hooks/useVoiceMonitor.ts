import { useEffect, useState } from 'react';

export type VoiceMonitorStatus =
  | 'listening'
  | 'processing'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'idle';

export interface VoiceMonitorMessage {
  role: 'user' | 'ai';
  content: string;
}

interface VoiceMonitorEvent {
  type: 'status' | 'emotion_status' | 'user_speech' | 'message';
  content?: string;
  status?: VoiceMonitorStatus;
  emotion?: string;
}

export const useVoiceMonitor = (userId: string) => {
  const [messages, setMessages] = useState<VoiceMonitorMessage[]>([]);
  const [emotion, setEmotion] = useState('Neutral');
  const [status, setStatus] = useState<VoiceMonitorStatus>('idle');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/voice-monitor/${encodeURIComponent(userId)}`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as VoiceMonitorEvent;

      if (data.type === 'status') {
        const nextStatus = data.status || data.content;
        if (isVoiceMonitorStatus(nextStatus)) {
          setStatus(nextStatus);
        }
        return;
      }

      if (data.type === 'emotion_status') {
        setEmotion(data.emotion || 'Neutral');
        return;
      }

      if (data.type === 'user_speech' && data.content) {
        setMessages((prev) => [...prev, { role: 'user', content: data.content || '' }]);
        return;
      }

      if (data.type === 'message' && data.content) {
        setMessages((prev) => [...prev, { role: 'ai', content: data.content || '' }]);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatus('idle');
    };

    return () => ws.close();
  }, [userId]);

  return {
    messages,
    emotion,
    status,
    isConnected,
  };
};

const isVoiceMonitorStatus = (value: unknown): value is VoiceMonitorStatus => {
  return (
    value === 'listening' ||
    value === 'processing' ||
    value === 'transcribing' ||
    value === 'thinking' ||
    value === 'speaking' ||
    value === 'idle'
  );
};
