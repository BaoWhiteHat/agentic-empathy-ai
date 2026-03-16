// app/empty-chair/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, ArrowRight, Flame } from 'lucide-react';


export default function EmptyChairPage() {
  const mode = 'empty-chair';
  const { messages, sendMessage, emotion } = useChat();
  
  // Quản lý trạng thái và bối cảnh trị liệu
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [unspokenNeed, setUnspokenNeed] = useState('');
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleStartSession = () => {
    if (targetName.trim() && relationship.trim() && unspokenNeed.trim()) {
      setIsSessionStarted(true);
      const initPayload = `[SYSTEM_INIT] TARGET: ${targetName} | RELATIONSHIP: ${relationship} | UNSPOKEN_NEED: ${unspokenNeed} | MESSAGE: Tôi đã sẵn sàng bắt đầu liệu pháp ghế trống.`;
      sendMessage(initPayload);
    }
  };

  const handleSendText = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
      resetTextareaHeight();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 relative transition-colors duration-300">
      
      {/* --- HEADER ĐẶC BIỆT --- */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-purple-500/20 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/30">
            <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              Liệu pháp Ghế trống
              {isSessionStarted && <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />}
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {isSessionStarted ? `Đang đối thoại với: ${targetName}` : 'Thiết lập không gian'}
            </p>
          </div>
        </div>

        {isSessionStarted && (
          <div className="flex items-center gap-3 bg-purple-500/5 border border-purple-500/10 px-4 py-2 rounded-2xl">
            <Flame className="w-4 h-4 text-purple-500" />
            <span className="text-[11px] text-purple-600/60 dark:text-purple-200/60 font-black uppercase tracking-widest">Cảm xúc:</span>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest animate-pulse">
              {emotion}
            </span>
          </div>
        )}
      </header>

      {/* --- GIAI ĐOẠN 1: MÀN HÌNH SETUP THIẾT LẬP --- */}
      <AnimatePresence mode="wait">
        {!isSessionStarted ? (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 overflow-y-auto custom-scrollbar"
          >
            <div className="w-full max-w-xl bg-card border border-purple-500/20 rounded-3xl p-8 shadow-2xl shadow-purple-900/10 relative overflow-hidden my-8">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
              
              <div className="w-16 h-16 mx-auto bg-purple-500/10 rounded-full flex items-center justify-center mb-4 border border-purple-500/20">
                <User className="w-8 h-8 text-purple-500" />
              </div>
              
              <h3 className="text-xl font-black text-foreground mb-2 text-center">Thiết lập Không gian An toàn</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-center px-4">
                Để quá trình chữa lành diễn ra sâu sắc nhất, hãy chia sẻ một chút về bối cảnh. Những thông tin này sẽ giúp tạo ra sự thấu cảm chính xác.
              </p>

              <div className="space-y-5 text-left">
                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">1. Người đang ngồi trên ghế là ai?</label>
                  <input 
                    value={targetName} onChange={(e) => setTargetName(e.target.value)}
                    placeholder="VD: Ba tôi, Người yêu cũ, Đứa trẻ bên trong tôi..."
                    className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">2. Mối quan hệ giữa hai người?</label>
                  <textarea 
                    value={relationship} onChange={(e) => setRelationship(e.target.value)}
                    placeholder="VD: Một người ba nghiêm khắc, hiếm khi thể hiện tình cảm..."
                    rows={2}
                    className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">3. Điều bạn chưa bao giờ dám nói?</label>
                  <textarea 
                    value={unspokenNeed} onChange={(e) => setUnspokenNeed(e.target.value)}
                    placeholder="VD: Tôi chỉ muốn được công nhận, được nghe một lời tự hào..."
                    rows={2}
                    className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none"
                  />
                </div>

                <button 
                  onClick={handleStartSession}
                  disabled={!targetName.trim() || !relationship.trim() || !unspokenNeed.trim()}
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm py-4 rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 group"
                >
                  Bắt đầu đối thoại
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />
          </motion.div>
        ) : (
          
          /* --- GIAI ĐOẠN 2: KHÔNG GIAN TRỊ LIỆU (CHAT) --- */
          <motion.div 
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col h-full w-full min-h-0"
          >
            {/* Vùng hiển thị tin nhắn */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scrollbar-hide min-h-0">
              
              {/* Lời chào đầu tiên của hệ thống */}
              <div className="flex justify-center mb-8">
                <div className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-medium px-6 py-2 rounded-full flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Không gian an toàn đã mở. Hãy nói ra những điều bạn cất giấu với {targetName}.
                </div>
              </div>

              <AnimatePresence initial={false}>
                {messages.filter(m => !m.content.startsWith("[SYSTEM_INIT]")).map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'ai' && (
                      <div className="w-8 h-8 rounded-xl bg-purple-900/20 border border-purple-500/30 flex items-center justify-center mb-1 shrink-0 relative overflow-hidden">
                        <User className="w-4 h-4 text-purple-400 opacity-50" />
                        <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
                      </div>
                    )}
                    
                    <div className={`group relative max-w-[70%] px-5 py-3.5 rounded-3xl shadow-sm text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-purple-600 text-white rounded-br-none font-medium' 
                        : 'bg-card/80 backdrop-blur-sm text-foreground rounded-bl-none border border-purple-500/20'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Vùng nhập liệu */}
            <footer className="p-8 pt-0 shrink-0">
              <div className="max-w-4xl mx-auto flex gap-3 items-end p-2 rounded-[2rem] bg-card border border-border focus-within:border-purple-500/40 focus-within:ring-4 focus-within:ring-purple-500/5 transition-all duration-300 shadow-2xl">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="flex-1 bg-transparent px-6 py-4 rounded-xl outline-none text-sm font-medium text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none leading-relaxed"
                  style={{ maxHeight: '160px', overflowY: 'auto' }}
                  placeholder={`Hãy nói thẳng với ${targetName}...`}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                />
                <motion.button
                  whileHover={input.trim() ? { scale: 1.05 } : {}}
                  whileTap={input.trim() ? { scale: 0.95 } : {}}
                  onClick={handleSendText}
                  disabled={!input.trim()}
                  className={`p-4 rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 px-6 mb-1 shrink-0 ${
                    !input.trim()
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-50'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}