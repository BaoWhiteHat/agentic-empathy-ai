// app/messaging/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat'; // Đã cập nhật lại đường dẫn tương đối
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Smile, User, Bot } from 'lucide-react';

export default function MessagingPage() {
  // Cố định mode cho trang này luôn, không cần lấy từ Context nữa
  const mode = 'messaging';
  const { messages, sendMessage, emotion, socket } = useChat();
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    const handleStatus = (event: any) => {
      const data = JSON.parse(event.data);
      if (data.type === "status") setStatus(data.content);
    };
    socket.addEventListener('message', handleStatus);
    return () => socket.removeEventListener('message', handleStatus);
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, status]);

  const handleSendText = () => {
    if (input.trim() && status === 'idle') {
      sendMessage(input);
      setInput("");
    }
  };

  const handleVoiceTrigger = () => {
    if (socket && status === 'idle') {
      socket.send(JSON.stringify({ action: "start_recording", mode: mode }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 relative transition-colors duration-300">
      {/* 1. Header (Đã được hardcode cho riêng chức năng Nhắn tin) */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-border px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-card rounded-2xl border border-border shadow-inner">
            <Bot className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              Nhắn tin thấu cảm
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Session Active</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 px-4 py-2 rounded-2xl">
          <Smile className="w-4 h-4 text-blue-500" />
          <span className="text-[11px] text-blue-600/60 dark:text-blue-200/60 font-black uppercase tracking-widest">Tình trạng:</span>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest animate-pulse">
            {emotion}
          </span>
        </div>
      </header>

      {/* 2. Chat Area (Giữ nguyên toàn bộ hiệu ứng UI đỉnh cao của cậu) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center mb-1 shrink-0">
                  <Bot className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                </div>
              )}
              
              <div className={`group relative max-w-[70%] px-5 py-3.5 rounded-3xl shadow-sm text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none font-medium' 
                  : 'bg-card/80 backdrop-blur-sm text-foreground rounded-bl-none border border-border'
              }`}>
                {msg.content}
                <div className={`absolute bottom-[-18px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-tighter ${
                  msg.role === 'user' ? 'right-0' : 'left-0'
                }`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mb-1 shrink-0">
                  <User className="w-4 h-4 text-blue-500" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Status Indicator */}
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-start pt-2"
            >
              <div className="bg-card/40 border border-border px-4 py-2.5 rounded-2xl flex items-center gap-3">
                 <div className="flex gap-1 items-center h-4">
                    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-blue-500 rounded-full" />
                    <motion.div animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-0.5 bg-blue-400 rounded-full" />
                    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-0.5 bg-blue-500 rounded-full" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400/80">
                   {status === 'speaking' ? "SoulMate đang nói..." : "Hệ thống đang nghe..."}
                 </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Floating Input Area */}
      <footer className="p-8 pt-0 relative z-10">
        <div className="max-w-4xl mx-auto relative">
          <AnimatePresence>
            {status === 'listening' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-12 left-0 right-0 flex justify-center"
              >
                <div className="bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full flex items-center gap-2">
                   <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                   <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Recording Audio...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex gap-3 items-center p-2 rounded-[2rem] bg-card border transition-all duration-300 shadow-2xl ${
            status === 'listening' ? 'border-red-500/30 ring-4 ring-red-500/5' : 'border-border focus-within:border-blue-500/40 focus-within:ring-4 focus-within:ring-blue-500/5'
          }`}>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVoiceTrigger}
              disabled={status !== 'idle' && status !== 'listening'}
              className={`p-4 rounded-[1.5rem] transition-all duration-300 relative group overflow-hidden ${
                status === 'listening' 
                ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' 
                : 'bg-background hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {status === 'listening' ? <MicOff className="w-5 h-5 relative z-10" /> : <Mic className="w-5 h-5 relative z-10" />}
            </motion.button>

            <input 
              className="flex-1 bg-transparent px-2 py-4 rounded-xl outline-none text-sm font-medium text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50"
              placeholder={status === 'listening' ? "Hãy nói điều gì đó..." : "Nhắn nhủ tâm tình với SoulMate..."}
              value={input}
              disabled={status === 'listening' || status === 'speaking'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            />

            <motion.button 
              whileHover={input.trim() ? { scale: 1.05 } : {}}
              whileTap={input.trim() ? { scale: 0.95 } : {}}
              onClick={handleSendText}
              disabled={!input.trim() || status !== 'idle'}
              className={`p-4 rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 px-6 ${
                !input.trim() || status !== 'idle'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-50'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Gửi đi</span>
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </footer>
    </div>
  );
}