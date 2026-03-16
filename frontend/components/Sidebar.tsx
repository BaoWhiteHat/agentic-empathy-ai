'use client';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { MessageSquare, Mic, UserRound, LogOut, HeartPulse, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import OceanChart from './OceanChart'; 
import Link from 'next/link'; // 💡 Import thẻ Link của Next.js
import { usePathname } from 'next/navigation'; // 💡 Lấy đường dẫn hiện tại

export default function Sidebar() {
  const { userId, setUserId } = useUser();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname(); // Ví dụ: '/messaging' hoặc '/voice'

  // Định nghĩa menu với path thay vì id
  const menuItems = [
    { path: '/messaging', label: 'Nhắn tin thấu cảm', icon: <MessageSquare className="w-5 h-5" /> },
    { path: '/voice', label: 'Tâm sự giọng nói', icon: <Mic className="w-5 h-5" /> },
    { path: '/empty-chair', label: 'Liệu pháp Ghế trống', icon: <UserRound className="w-5 h-5" /> },
  ];

  const handleLogout = () => {
    setUserId(''); 
  };

  return (
    <aside className="w-80 h-full bg-card/50 backdrop-blur-xl border-r border-border flex flex-col p-6 shadow-2xl transition-colors duration-300 overflow-y-auto custom-scrollbar shrink-0">
      
      {/* 1. KHU VỰC HEADER */}
      <div className="mb-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/30">
            <HeartPulse className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">
              SoulMate AI
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Companion</p>
          </div>
        </div>
      </div>

      {/* 2. KHU VỰC BIỂU ĐỒ OCEAN */}
      <div className="mb-8 w-full min-h-[320px] bg-background/40 rounded-2xl border border-border relative flex flex-col items-center justify-start shadow-inner transition-colors shrink-0">
        <p className="w-full text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-4 pb-2 border-b border-border/50">
          Biến thiên tâm lý
        </p>
        <div className="w-full flex-1 p-2">
           {userId ? <OceanChart userId={userId} /> : null}
        </div>
      </div>

      {/* 3. KHU VỰC MENU (Đã sửa thành Link) */}
      <nav className="flex-1 space-y-2 mb-8 shrink-0">
        {menuItems.map((item) => {
          // Kiểm tra xem URL có khớp với nút menu không
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/messaging');

          return (
            <Link href={item.path} key={item.path} className="block w-full">
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-4 transition-all duration-300 relative group overflow-hidden ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                {isActive && (
                   <motion.div 
                     layoutId="active-indicator"
                     className="absolute left-0 w-1 h-6 bg-blue-500 rounded-full"
                   />
                )}
                <div className={`p-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-500/20' : 'bg-slate-200 dark:bg-slate-800/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700/50'
                }`}>
                  {item.icon}
                </div>
                <span className="font-semibold text-sm">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* 4. KHU VỰC FOOTER (Đổi Theme & Logout) */}
      <div className="mt-auto pt-6 border-t border-border space-y-4 shrink-0">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center gap-4 p-3.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 transition-all duration-300 group border border-transparent hover:border-border"
        >
          <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700/50 transition-colors text-amber-500 dark:text-blue-400">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </div>
          <span className="font-semibold text-sm">{theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}</span>
        </button>

        <div className="p-4 bg-background/50 rounded-2xl border border-border flex items-center gap-4 group cursor-default shadow-sm">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-blue-900/40">
              {userId?.[0].toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-card rounded-full flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            </div>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-foreground truncate group-hover:text-blue-500 transition-colors">{userId}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Trực tuyến</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 text-xs font-bold border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          ĐĂNG XUẤT
        </button>
      </div>
    </aside>
  );
}