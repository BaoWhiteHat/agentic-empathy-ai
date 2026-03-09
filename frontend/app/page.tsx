// app/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { useMode } from './layout';

export default function Home() {
  const { mode } = useMode();
  const { messages, sendMessage, emotion, socket } = useChat();
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lắng nghe trạng thái từ Backend
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
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hàm gửi tin nhắn văn bản
  const handleSendText = () => {
    if (input.trim() && status === 'idle') {
      sendMessage(input);
      setInput("");
    }
  };

  // Hàm kích hoạt thu âm
  const handleVoiceTrigger = () => {
    if (socket && status === 'idle') {
      socket.send(JSON.stringify({ action: "start_recording", mode: mode }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* 1. Header hiển thị Mode & Emotion */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <h2 className="text-blue-400 font-bold uppercase tracking-widest text-sm">
          {mode === 'messaging' && "💬 Nhắn tin thấu cảm"}
          {mode === 'voice' && "🎙️ Tâm sự giọng nói"}
          {mode === 'empty-chair' && "💺 Trị liệu Ghế trống"}
        </h2>
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase">Cảm xúc của bạn:</span>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold border border-blue-500/30 animate-pulse">
                {emotion}
            </span>
        </div>
      </div>

      {/* 2. Danh sách tin nhắn */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {/* Hiệu ứng khi AI đang nói */}
        {status === 'speaking' && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-800 p-3 rounded-2xl text-blue-400 text-xs flex items-center gap-2">
               <div className="flex gap-1">
                  <div className="w-1 h-3 bg-blue-500 animate-bounce"></div>
                  <div className="w-1 h-3 bg-blue-500 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1 h-3 bg-blue-500 animate-bounce [animation-delay:0.4s]"></div>
               </div>
               SoulMate đang nói...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* 3. Thanh công cụ Input & Buttons */}
      <div className="p-6 bg-slate-900/80 border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          {status === 'listening' && (
            <p className="text-center text-red-500 text-xs mb-3 animate-pulse font-bold tracking-widest">
              🔴 HỆ THỐNG ĐANG LẮNG NGHE... HÃY NÓI ĐI
            </p>
          )}
          
          <div className="flex gap-3 items-center">
            {/* Nút Mic (Voice) */}
            <button 
              onClick={handleVoiceTrigger}
              disabled={status !== 'idle'}
              className={`p-4 rounded-xl transition-all ${
                status === 'listening' 
                ? 'bg-red-600 animate-pulse scale-110' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
              title="Gửi giọng nói"
            >
              {status === 'listening' ? '🛑' : '🎤'}
            </button>

            {/* Ô nhập văn bản */}
            <input 
              className="flex-1 bg-slate-950 border border-slate-800 p-4 rounded-xl outline-none focus:border-blue-500/50 transition-all text-slate-200"
              placeholder={status === 'listening' ? "Đang thu âm..." : "Nhắn nhủ tâm tình với SoulMate..."}
              value={input}
              disabled={status === 'listening'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            />

            {/* NÚT GỬI TEXT (TRẢ LẠI CHO BẢO NÈ!) */}
            <button 
              onClick={handleSendText}
              disabled={!input.trim() || status !== 'idle'}
              className={`p-4 rounded-xl font-bold transition-all ${
                !input.trim() || status !== 'idle'
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
              }`}
            >
              GỬI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}