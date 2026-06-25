import './globals.css';
import type { Metadata } from 'next';
import { UserProvider } from '../context/UserContext';
import { TweaksProvider } from '../context/TweaksContext';

export const metadata: Metadata = {
  title: 'SoulMate — a calm companion',
  description: 'A multi-agent AI companion with empathy, graph memory, and personality awareness.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body>
        <TweaksProvider>
          <UserProvider>{children}</UserProvider>
        </TweaksProvider>
      </body>
    </html>
  );
}
