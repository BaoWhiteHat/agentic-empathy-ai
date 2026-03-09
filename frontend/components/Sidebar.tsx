'use client';
import { useUser } from '../context/UserContext';

// Định nghĩa các mode để dễ quản lý
export type AppMode = 'messaging' | 'voice' | 'empty-chair';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

export default function Sidebar({ currentMode, setMode }: SidebarProps) {
  const { userId } = useUser();

  const menuItems = [
    { id: 'messaging', label: '💬 Nhắn tin thấu cảm', icon: '✉️' },
    { id: 'voice', label: '🎙️ Tâm sự giọng nói', icon: '🎤' },
    { id: 'empty-chair', label: '🪑 Liệu pháp Ghế trống', icon: '💺' },
  ];

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shadow-xl">
      <div className="mb-10 px-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          SoulMate AI
        </h2>
        <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">UIT Final Project</p>
      </div>

      <nav className="flex-1 space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id as AppMode)}
            className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all ${
              currentMode === item.id 
                ? 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Phần hiển thị User Profile & OCEAN bên dưới (sẽ làm sau) */}
      <div className="mt-auto pt-6 border-t border-slate-800">
        <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold">
            {userId?.[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">{userId}</p>
            <p className="text-[10px] text-green-500">● Đang trực tuyến</p>
          </div>
        </div>
      </div>
    </aside>
  );
}