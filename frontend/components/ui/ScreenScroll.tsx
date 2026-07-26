'use client';
import React from 'react';

export function ScreenScroll({ children, max = 980 }: { children: React.ReactNode; max?: number }) {
  return (
    <div className="screen-scroll no-scrollbar" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="screen-scroll-content" style={{ maxWidth: max, margin: '0 auto', padding: '40px 40px 64px' }}>{children}</div>
    </div>
  );
}

export default ScreenScroll;
