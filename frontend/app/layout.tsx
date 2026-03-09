'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider, useUser } from '../context/UserContext';
import Sidebar, { AppMode } from '../components/Sidebar'; // Nhớ export AppMode từ Sidebar
import { useState, createContext, useContext } from 'react';

const inter = Inter({ subsets: ['latin'] });

// Tạo một Context nhỏ để quản lý Mode trên toàn ứng dụng
const ModeContext = createContext({
  mode: 'messaging' as AppMode,
  setMode: (m: AppMode) => {},
});

export const useMode = () => useContext(ModeContext);

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { userId, setUserId } = useUser();
  const [tempId, setTempId] = useState('');
  const [currentMode, setCurrentMode] = useState<AppMode>('messaging');

  // 1. Màn hình Đăng nhập (Nếu chưa có userId)
  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-500 mb-2">SoulMate AI</h1>
          <p className="text-slate-400 text-sm">Hệ thống trợ lý AI thấu cảm (Agentic AI Companion)</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md">
          <label className="block text-sm font-medium text-slate-400 mb-2">Nhập User ID để bắt đầu:</label>
          <input 
            className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl mb-6 focus:border-blue-500 outline-none transition-all"
            placeholder="Ví dụ: bao_uit..."
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tempId && setUserId(tempId)}
          />
          <button 
            onClick={() => tempId && setUserId(tempId)}
            className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-xl font-bold transition-all"
          >
            Vào phòng chat
          </button>
        </div>
      </div>
    );
  }

  // 2. Giao diện chính (Nếu đã có userId)
  return (
    <ModeContext.Provider value={{ mode: currentMode, setMode: setCurrentMode }}>
      <div className="flex h-screen w-full bg-slate-950 text-white overflow-hidden">
        {/* Truyền đúng props vào Sidebar để tránh lỗi */}
        <Sidebar currentMode={currentMode} setMode={setCurrentMode} />
        
        <main className="flex-1 flex flex-col relative min-w-0">
          {children}
        </main>
      </div>
    </ModeContext.Provider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.className} antialiased`}>
        <UserProvider>
          <AuthWrapper>
            {children}
          </AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}