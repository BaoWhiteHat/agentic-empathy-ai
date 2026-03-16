'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider, useUser } from '../context/UserContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar'; // 💡 Bỏ AppMode vì Sidebar mới không cần nó nữa
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, HeartPulse, Moon, Sun } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

// 💡 ĐÃ XÓA: ModeContext và useMode vì chúng ta dùng URL (Routing) để quản lý Mode

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { userId, setUserId } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [tempId, setTempId] = useState('');

  // 1. MÀN HÌNH ĐĂNG NHẬP (Giữ nguyên giao diện đẹp của cậu)
  if (!userId) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-background text-foreground transition-colors duration-300 overflow-hidden">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="absolute top-8 right-8 z-20">
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-2xl bg-card border border-border shadow-lg hover:scale-110 transition-all"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md px-6 text-center"
        >
          <motion.div className="inline-flex items-center justify-center p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 mb-6">
            <HeartPulse className="w-10 h-10 text-blue-500" />
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight mb-10">
            Soul<span className="text-blue-500">Mate</span>
          </h1>

          <div className="bg-card/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-border shadow-2xl space-y-6 text-left">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Định danh của bạn</label>
              <input 
                autoFocus
                className="w-full px-5 py-4 bg-background/50 border border-border rounded-2xl outline-none focus:border-blue-500/50 transition-all font-medium"
                placeholder="Ví dụ: bao_uit..."
                value={tempId}
                onChange={(e) => setTempId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tempId && setUserId(tempId)}
              />
            </div>
            <button 
              onClick={() => tempId && setUserId(tempId)}
              className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
            >
              Bắt đầu hành trình <Sparkles className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-8 text-slate-500 text-xs font-medium uppercase tracking-widest">Developed with ❤️ at UIT</p>
        </motion.div>
      </div>
    );
  }

  // 2. GIAI ĐOẠN ĐÃ ĐĂNG NHẬP
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300">
      {/* 💡 SỬA TẠI ĐÂY: Sidebar giờ không cần truyền Props nữa vì nó tự dùng usePathname() */}
      <Sidebar /> 
      
      <main className="flex-1 flex flex-col relative min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)]">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <UserProvider>
          <ThemeProvider>
            <AuthWrapper>
              {children}
            </AuthWrapper>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}