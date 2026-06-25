'use client';
// components/SoulMateApp.tsx — the single app shell (port of design app.jsx).
// Sidebar + internal screen routing + onboarding gate. Personalisation now lives
// in TweaksContext (CSS vars applied there); screens read it directly.
import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useOcean } from '../hooks/useOcean';
import { useTweaks } from '../context/TweaksContext';
import { Sidebar } from './Sidebar';
import { OnboardingShell } from './screens/Onboarding';
import { TodayScreen, MoodCheckIn } from './screens/Today';
import { CompanionScreen } from './screens/Companion';
import { ReflectionsScreen } from './screens/Reflections';
import { InsightScreen } from './screens/Insight';
import { SettingsScreen } from './screens/Settings';
import { SafetyScreen } from './screens/Safety';
import { MemoryScreen } from './screens/Memory';
import { seedWeekMoods } from '../lib/seedMoods';

export type ScreenId = 'today' | 'companion' | 'reflections' | 'insights' | 'settings' | 'safety' | 'memory';

export function SoulMateApp() {
  const { userId, setUserId } = useUser();
  const { tweaks, set } = useTweaks();
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('today');
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);

  const { ocean, narrative, loaded: oceanLoaded, error: oceanError } = useOcean(userId);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate avoids SSR hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  // Seed demo mood data once userId is known. Keyed on userId so it fires when
  // it transitions from '' to the real value, not just on the empty-string mount.
  useEffect(() => {
    if (userId) seedWeekMoods();
  }, [userId]);

  const completeOnboarding = (name: string) => { setUserId(name); setScreen('today'); };
  const toggleTheme = () => set('darkMode', !tweaks.darkMode);

  // Avoid hydration mismatch: wait until we know the persisted userId.
  if (!mounted) return null;

  if (!userId) {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }} className="no-scrollbar">
        <OnboardingShell style="guided" onComplete={completeOnboarding} />
      </div>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'today': return <TodayScreen name={userId} todayMood={todayMood} ocean={ocean} narrative={narrative} oceanLoaded={oceanLoaded} oceanError={oceanError} onNavigate={setScreen} onCheckIn={() => setMoodOpen(true)} />;
      case 'companion': return <CompanionScreen name={userId} onExit={() => setScreen('today')} />;
      case 'reflections': return <ReflectionsScreen />;
      case 'insights': return <InsightScreen ocean={ocean} narrative={narrative} loaded={oceanLoaded} error={oceanError} />;
      case 'settings': return <SettingsScreen name={userId} onConsentReview={() => setScreen('memory')} onOpenSafety={() => setScreen('safety')} onLogout={() => { localStorage.removeItem('soulmate_user_id'); setUserId(''); }} />;
      case 'safety': return <SafetyScreen onBack={() => setScreen('settings')} />;
      case 'memory': return <MemoryScreen />;
      default: return null;
    }
  };

  return (
    <>
      <div className={tweaks.focusMode ? 'app-shell focus-mode' : 'app-shell'} style={{ display: 'flex', height: '100%', background: 'radial-gradient(120% 90% at 100% 0%, var(--bg-tint), var(--bg))' }}>
        <Sidebar screen={screen} onNavigate={setScreen} ocean={ocean} dark={tweaks.darkMode} onToggleTheme={toggleTheme} name={userId} onOpenSettings={() => setScreen('settings')} />
        <main style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          {renderScreen()}
        </main>
      </div>
      {moodOpen && (
        <MoodCheckIn style="weather" onClose={() => setMoodOpen(false)} onComplete={(id, nextAction) => {
          // The mood check-in modal now persists the entry (mood + note) to
          // localStorage itself; here we only reflect it in-session and navigate.
          setTodayMood(id);
          setMoodOpen(false);
          if (nextAction === 'talk') setScreen('companion');
        }} />
      )}
    </>
  );
}

export default SoulMateApp;
