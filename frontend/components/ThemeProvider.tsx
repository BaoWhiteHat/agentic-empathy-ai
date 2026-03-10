// components/ThemeProvider.tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Tạo một type mới: Lấy tất cả props của NextThemesProvider VÀ thêm children vào
type CustomThemeProviderProps = React.ComponentProps<typeof NextThemesProvider> & {
  children: React.ReactNode;
};

export function ThemeProvider({ children, ...props }: CustomThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}