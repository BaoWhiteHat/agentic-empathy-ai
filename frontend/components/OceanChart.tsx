// components/OceanChart.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { HeartPulse } from 'lucide-react';

interface OceanChartProps {
  userId: string;
}

export default function OceanChart({ userId }: OceanChartProps) {
  const { theme } = useTheme();
  const [oceanData, setOceanData] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchOcean = async () => {
      try {
        const res = await fetch(`http://localhost:8000/profile/ocean/${userId}`);
        if (res.ok) {
          const data = await res.json();
          // Chuyển đổi dữ liệu từ Backend (thang 0-1) sang Recharts (thang 0-100)
          setOceanData([
            { subject: 'Sẵn sàng trải nghiệm', A: data.openness * 100 },
            { subject: 'Tận tâm', A: data.conscientiousness * 100 },
            { subject: 'Hướng ngoại', A: data.extraversion * 100 },
            { subject: 'Dễ chịu', A: data.agreeableness * 100 },
            { subject: 'Nhạy cảm', A: data.neuroticism * 100 },
          ]);
        }
      } catch (e) {
        console.error("Lỗi lấy dữ liệu OCEAN:", e);
      }
    };

    // Gọi lần đầu tiên
    fetchOcean();
    
    // Thiết lập vòng lặp tự động cập nhật mỗi 5 giây
    const interval = setInterval(fetchOcean, 5000); 
    return () => clearInterval(interval);
  }, [userId]);

  if (oceanData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-2 text-xs text-blue-500 font-medium">
        <HeartPulse size={14} className="animate-bounce" /> Đang đồng bộ tâm lý...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="65%" data={oceanData}>
        {/* Lưới mạng nhện: Đổi màu theo Sáng/Tối */}
        <PolarGrid stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
        
        {/* Tên 5 trục tâm lý */}
        <PolarAngleAxis 
          dataKey="subject" 
          tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 9, fontWeight: 700 }} 
        />
        
        {/* Khối màu biểu đồ */}
        <Radar 
          name="Tâm lý" 
          dataKey="A" 
          stroke="#3b82f6" 
          strokeWidth={2}
          fill="url(#colorOceanGradient)" 
          fillOpacity={0.6} 
        />
        
        {/* Hiệu ứng màu gradient cho đẹp */}
        <defs>
          <linearGradient id="colorOceanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
      </RadarChart>
    </ResponsiveContainer>
  );
}   