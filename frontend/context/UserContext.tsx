// context/UserContext.tsx
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext({
  userId: '',
  setUserId: (id: string) => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState('');

  // Lưu userId vào trình duyệt để F5 không bị mất "đăng nhập"
  useEffect(() => {
    const savedId = localStorage.getItem('soulmate_user_id');
    if (savedId) setUserId(savedId);
  }, []);

  const handleSetUserId = (id: string) => {
    setUserId(id);
    localStorage.setItem('soulmate_user_id', id);
  };

  return (
    <UserContext.Provider value={{ userId, setUserId: handleSetUserId }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);