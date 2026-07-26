'use client';
// components/SoulMateApp.tsx — the single app shell (port of design app.jsx).
// Sidebar + internal screen routing + onboarding gate. Personalisation now lives
// in TweaksContext (CSS vars applied there); screens read it directly.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useOcean } from '../hooks/useOcean';
import { useTweaks } from '../context/TweaksContext';
import { MobileNavigation, Sidebar } from './Sidebar';
import { OnboardingShell } from './screens/Onboarding';
import { TodayScreen, MoodCheckIn } from './screens/Today';
import { CompanionScreen } from './screens/Companion';
import { ReflectionsScreen } from './screens/Reflections';
import { InsightScreen } from './screens/Insight';
import { SettingsScreen } from './screens/Settings';
import { SafetyScreen, type CrisisSupportSession } from './screens/Safety';
import { MemoryScreen } from './screens/Memory';
import { seedDemoMoods } from '../lib/seedMoods';

export type ScreenId = 'today' | 'companion' | 'reflections' | 'insights' | 'settings' | 'safety' | 'memory';

const SCREEN_VERSION = 1;
const SCREEN_IDS: ScreenId[] = ['today', 'companion', 'reflections', 'insights', 'settings', 'safety', 'memory'];

const lastScreenKeyFor = (userId: string) => `soulmate_last_screen_v${SCREEN_VERSION}_${userId}`;
const isValidScreen = (value: unknown): value is ScreenId =>
  typeof value === 'string' && SCREEN_IDS.includes(value as ScreenId);

interface SafetyOverlayState {
  id: number;
  crisisSupport?: CrisisSupportSession;
}

export function SoulMateApp() {
  const { userId, setUserId } = useUser();
  const { tweaks, set } = useTweaks();
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('today');
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [safetyOverlay, setSafetyOverlay] = useState<SafetyOverlayState | null>(null);
  const screenHydratedUserRef = useRef<string | null>(null);
  const skipNextScreenPersistRef = useRef(false);
  const safetyOverlayIdRef = useRef(0);

  const { ocean, narrative, loaded: oceanLoaded, error: oceanError } = useOcean(userId);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate avoids SSR hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  // Seed demo mood data once userId is known. Keyed on userId so it fires when
  // it transitions from '' to the real value, not just on the empty-string mount.
  useEffect(() => {
    if (userId) seedDemoMoods();
  }, [userId]);

  useEffect(() => {
    if (!mounted || !userId) {
      screenHydratedUserRef.current = null;
      skipNextScreenPersistRef.current = false;
      return;
    }

    let nextScreen: ScreenId = 'today';
    try {
      const stored = localStorage.getItem(lastScreenKeyFor(userId));
      if (isValidScreen(stored)) nextScreen = stored;
    } catch { /* ignore localStorage failures and fall back to Today */ }

    screenHydratedUserRef.current = userId;
    skipNextScreenPersistRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate last internal screen after user context is known
    setScreen(nextScreen);
  }, [mounted, userId]);

  useEffect(() => {
    if (!mounted || !userId || screenHydratedUserRef.current !== userId) return;
    if (skipNextScreenPersistRef.current) {
      skipNextScreenPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(lastScreenKeyFor(userId), screen);
    } catch { /* ignore localStorage failures */ }
  }, [mounted, userId, screen]);

  const completeOnboarding = (name: string) => { setUserId(name); setScreen('today'); };
  const toggleTheme = () => set('darkMode', !tweaks.darkMode);
  const openSafetyOverlay = useCallback((crisisSupport?: CrisisSupportSession) => {
    safetyOverlayIdRef.current += 1;
    setSafetyOverlay({ id: safetyOverlayIdRef.current, crisisSupport });
  }, []);
  const navigate = useCallback((nextScreen: ScreenId) => {
    setSafetyOverlay(null);
    setScreen(nextScreen);
  }, []);
  const logout = () => {
    // Visible chat history is preserved locally across logout for prototype continuity.
    // This is not secure authentication storage.
    localStorage.removeItem('soulmate_user_id');
    setUserId('');
  };

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
      case 'companion': return <CompanionScreen name={userId} onExit={() => setScreen('today')} onOpenSafety={openSafetyOverlay} />;
      case 'reflections': return <ReflectionsScreen />;
      case 'insights': return <InsightScreen ocean={ocean} narrative={narrative} loaded={oceanLoaded} error={oceanError} />;
      case 'settings': return <SettingsScreen name={userId} onConsentReview={() => setScreen('memory')} onOpenSafety={() => setScreen('safety')} onLogout={logout} />;
      case 'safety': return <SafetyScreen onBack={() => setScreen('settings')} />;
      case 'memory': return <MemoryScreen />;
      default: return null;
    }
  };

  return (
    <>
      <div className={tweaks.focusMode ? 'app-shell focus-mode' : 'app-shell'} style={{ display: 'flex', height: '100%', background: 'radial-gradient(120% 90% at 100% 0%, var(--bg-tint), var(--bg))' }}>
        <Sidebar screen={safetyOverlay ? 'safety' : screen} onNavigate={navigate} ocean={ocean} dark={tweaks.darkMode} onToggleTheme={toggleTheme} name={userId} onOpenSettings={() => navigate('settings')} />
        <main className="app-main" style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div aria-hidden={safetyOverlay ? true : undefined} style={{ height: '100%', visibility: safetyOverlay ? 'hidden' : 'visible' }}>
            {renderScreen()}
          </div>
          {safetyOverlay && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'var(--bg)' }}>
              <SafetyScreen key={safetyOverlay.id} onBack={() => setSafetyOverlay(null)} crisisSupport={safetyOverlay.crisisSupport} />
            </div>
          )}
        </main>
        <MobileNavigation screen={safetyOverlay ? 'safety' : screen} onNavigate={navigate} onOpenSettings={() => navigate('settings')} />
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
