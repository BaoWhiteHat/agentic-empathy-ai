'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider, useUser } from '../context/UserContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import Sidebar, { AppMode } from '../components/Sidebar';
import { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, HeartPulse, Moon, Sun } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

const ModeContext = createContext({
  mode: 'messaging' as AppMode,
  setMode: (m: AppMode) => {},
});

export const useMode = () => useContext(ModeContext);

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { userId, setUserId } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [tempId, setTempId] = useState('');
  const [currentMode, setCurrentMode] = useState<AppMode>('messaging');

  if (!userId) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-background text-foreground transition-colors duration-300 overflow-hidden">
        {/* Abstract Background Blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 dark:opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 dark:opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 dark:opacity-20 animate-blob animation-delay-4000"></div>

        {/* Theme Toggle for Login Screen */}
        <div className="absolute top-8 right-8 z-20">
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-2xl bg-card border border-border shadow-lg hover:scale-110 transition-all text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 w-full max-w-md px-6"
        >
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="inline-flex items-center justify-center p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20 mb-6"
            >
              <HeartPulse className="w-10 h-10 text-blue-500" />
            </motion.div>
            <h1 className="text-5xl font-black tracking-tight text-foreground mb-3">
              Soul<span className="text-blue-500">Mate</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Hệ thống trợ lý AI thấu cảm thế hệ mới</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-card/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-border shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Định danh của bạn</label>
                <input 
                  autoFocus
                  className="w-full px-5 py-4 bg-background/50 border border-border rounded-2xl text-foreground placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all duration-300 font-medium"
                  placeholder="Ví dụ: bao_uit..."
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && tempId && setUserId(tempId)}
                />
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => tempId && setUserId(tempId)}
                className="w-full group relative flex items-center justify-center p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all duration-300 shadow-xl shadow-blue-900/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2">
                  Bắt đầu hành trình <Sparkles className="w-4 h-4" />
                </span>
              </motion.button>
            </div>
          </motion.div>
          
          <p className="mt-8 text-center text-slate-500 text-xs font-medium uppercase tracking-widest">
            Developed with ❤️ at UIT
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ModeContext.Provider value={{ mode: currentMode, setMode: setCurrentMode }}>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300">
        <Sidebar currentMode={currentMode} setMode={setCurrentMode} />
        <main className="flex-1 flex flex-col relative min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)]">
          {children}
        </main>
      </div>
    </ModeContext.Provider>
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
