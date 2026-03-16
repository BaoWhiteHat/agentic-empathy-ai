// app/voice/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Smile, Waves } from 'lucide-react';

export default function VoicePage() {
  const mode = 'voice';
  const { messages, emotion, socket } = useChat();
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');

  // Lấy tin nhắn gần nhất để hiển thị text phụ trợ (Subtitle)
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    if (!socket) return;
    const handleStatus = (event: any) => {
      const data = JSON.parse(event.data);
      if (data.type === "status") setStatus(data.content);
    };
    socket.addEventListener('message', handleStatus);
    return () => socket.removeEventListener('message', handleStatus);
  }, [socket]);

  const handleVoiceTrigger = () => {
    if (socket && status === 'idle') {
      socket.send(JSON.stringify({ action: "start_recording", mode: mode, use_voice: true }));
    }
  };

  // Cấu hình màu sắc và hiệu ứng dựa theo trạng thái
  const stateConfig = {
    idle: {
      color: 'bg-blue-500',
      ringColor: 'border-blue-500/30',
      shadow: 'shadow-blue-500/20',
      text: 'Chạm để bắt đầu tâm sự',
      icon: <Mic className="w-12 h-12 text-white" />
    },
    listening: {
      color: 'bg-red-500',
      ringColor: 'border-red-500/50',
      shadow: 'shadow-red-500/40',
      text: 'Đang lắng nghe tâm tư của bạn...',
      icon: <MicOff className="w-12 h-12 text-white" />
    },
    speaking: {
      color: 'bg-indigo-500',
      ringColor: 'border-indigo-500/50',
      shadow: 'shadow-indigo-500/40',
      text: 'SoulMate đang phản hồi...',
      icon: <Waves className="w-12 h-12 text-white animate-pulse" />
    }
  };

  const currentConfig = stateConfig[status];

  return (
    <div className="flex flex-col h-full bg-background/50 relative overflow-hidden transition-colors duration-500">
      
      {/* 1. HEADER TỐI GIẢN */}
      <header className="relative z-20 px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              Tâm sự giọng nói
              <span className={`flex h-2 w-2 rounded-full ${status === 'listening' ? 'bg-red-500 animate-ping' : 'bg-green-500 animate-pulse'}`} />
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Voice Session</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 px-4 py-2 rounded-2xl backdrop-blur-md">
          <Smile className="w-4 h-4 text-indigo-500" />
          <span className="text-[11px] text-indigo-600/60 dark:text-indigo-200/60 font-black uppercase tracking-widest">Cảm xúc:</span>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest animate-pulse">
            {emotion}
          </span>
        </div>
      </header>

      {/* 2. KHU VỰC TRUNG TÂM (ORB INTERFACE) */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* Khối cầu năng lượng */}
        <div className="relative flex items-center justify-center w-64 h-64 mb-12">
          {/* Vòng tròn lan tỏa 1 */}
          <motion.div
            animate={{ scale: status === 'listening' ? [1, 1.5, 1] : status === 'speaking' ? [1, 1.8, 1] : [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: status === 'idle' ? 3 : 1.5, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute inset-0 rounded-full border-2 ${currentConfig.ringColor}`}
          />
          {/* Vòng tròn lan tỏa 2 */}
          <motion.div
            animate={{ scale: status === 'listening' ? [1, 1.8, 1] : status === 'speaking' ? [1, 2.2, 1] : [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: status === 'idle' ? 3 : 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            className={`absolute inset-0 rounded-full border-2 ${currentConfig.ringColor}`}
          />
          
          {/* Nút bấm chính */}
          <motion.button
            whileHover={status === 'idle' ? { scale: 1.05 } : {}}
            whileTap={status === 'idle' ? { scale: 0.95 } : {}}
            onClick={handleVoiceTrigger}
            disabled={status !== 'idle'}
            className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${currentConfig.color} ${currentConfig.shadow}`}
          >
            {/* Hiệu ứng sóng âm mini bên trong nút khi đang nói */}
            {status === 'speaking' && (
               <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-50">
                  <motion.div animate={{ height: [20, 60, 20] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1.5 bg-white rounded-full" />
                  <motion.div animate={{ height: [20, 80, 20] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-1.5 bg-white rounded-full" />
                  <motion.div animate={{ height: [20, 40, 20] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-1.5 bg-white rounded-full" />
               </div>
            )}
            <div className="relative z-20">
              {currentConfig.icon}
            </div>
          </motion.button>
        </div>

        {/* Trạng thái hệ thống */}
        <motion.p 
          key={status} // Đổi key để trigger animation mỗi khi status đổi
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-8 text-center"
        >
          {currentConfig.text}
        </motion.p>

        {/* Phụ đề (Subtitles) hiển thị nội dung đang giao tiếp */}
        <div className="h-24 px-8 max-w-2xl w-full flex items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {lastMessage && status !== 'listening' && (
              <motion.div
                key={lastMessage.content}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`text-lg md:text-xl font-medium leading-relaxed ${
                  lastMessage.role === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                "{lastMessage.content}"
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Background mờ ảo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
    </div>
  );
}