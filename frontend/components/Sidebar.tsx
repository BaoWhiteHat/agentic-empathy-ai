'use client';
// components/Sidebar.tsx — calm brand rail + nav + mini OCEAN + footer
import React from 'react';
import { Icon } from './ui/Icon';
import { OceanRadar, type OceanData } from './ui/Ocean';
import type { ScreenId } from './SoulMateApp';

export const NAV: { id: ScreenId; label: string; icon: string; status: 'A' | 'B' | 'C' }[] = [
  { id: 'today', label: 'Today', icon: 'sun', status: 'B' },
  { id: 'companion', label: 'Companion', icon: 'chat', status: 'A' },
  { id: 'reflections', label: 'Reflections', icon: 'feather', status: 'B' },
  { id: 'insights', label: 'Insights', icon: 'compass', status: 'A' },
];

interface SidebarProps {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
  ocean: OceanData;
  dark: boolean;
  onToggleTheme: () => void;
  name: string;
  onOpenSettings: () => void;
}

export function Sidebar({ screen, onNavigate, ocean, dark, onToggleTheme, name, onOpenSettings }: SidebarProps) {
  const initial = (name || 'You').charAt(0).toUpperCase();
  return (
    <aside style={{ width: 264, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 18px', borderRight: '1px solid var(--line)', background: 'var(--surface)', overflowY: 'auto' }} className="app-sidebar no-scrollbar">
      {/* brand */}
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 20px' }}>
        <div className="sidebar-logo" style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px color-mix(in oklab, var(--sage) 40%, transparent)' }}>
          <Icon name="heart" size={21} fill="#fff" stroke={0} />
        </div>
        <div className="sidebar-brand-copy">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' }}>SoulMate</div>
          <div className="label" style={{ fontSize: 9.5, marginTop: 3 }}>a calm companion</div>
        </div>
      </div>

      {/* mini OCEAN */}
      <button className="sidebar-ocean-preview" aria-label="Open Insights" onClick={() => onNavigate('insights')} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        <span className="label" style={{ fontSize: 9.5, marginBottom: 6, alignSelf: 'flex-start' }}>Your reflection</span>
        <OceanRadar data={ocean} size={150} showLabels={false} />
      </button>

      {/* nav */}
      <nav className="sidebar-nav" aria-label="Primary navigation" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map((n) => {
          const on = screen === n.id;
          return (
            <button className="sidebar-nav-item" key={n.id} onClick={() => onNavigate(n.id)} title={n.label} aria-label={n.label} aria-current={on ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 'var(--r-sm)', border: 'none', textAlign: 'left', background: on ? 'var(--sage-tint)' : 'transparent', color: on ? 'var(--sage-deep)' : 'var(--ink-soft)', fontWeight: on ? 600 : 500, fontSize: 14.5, transition: 'color .18s, font-weight .18s', position: 'relative' }}>
              {on && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 99, background: 'var(--sage)' }} />}
              <Icon name={n.icon} size={19} stroke={on ? 2 : 1.75} /><span className="sidebar-label">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* footer */}
      <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="sidebar-footer-action" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--ink-soft)', fontWeight: 500, fontSize: 13.5, textAlign: 'left' }}>
          <Icon name={dark ? 'sun' : 'moon'} size={18} /><span className="sidebar-label">{dark ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="sidebar-footer-action" aria-label="Open Settings" title="Settings" onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--ink-soft)', fontWeight: 500, fontSize: 13.5, textAlign: 'left' }}>
          <Icon name="gear" size={18} /><span className="sidebar-label">Settings</span>
        </button>
        <div className="sidebar-profile" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 8px', marginTop: 4, borderTop: '1px solid var(--line)' }}>
          <div className="sidebar-avatar" title={name || 'You'} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{initial}</div>
          <div className="sidebar-profile-copy" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'You'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Private space</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation({ screen, onNavigate, onOpenSettings }: Pick<SidebarProps, 'screen' | 'onNavigate' | 'onOpenSettings'>) {
  const settingsActive = screen === 'settings' || screen === 'safety' || screen === 'memory';
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {NAV.map((item) => {
        const active = screen === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className="mobile-nav-item"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={20} stroke={active ? 2.2 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="mobile-nav-item"
        aria-label="Settings"
        aria-current={settingsActive ? 'page' : undefined}
        onClick={onOpenSettings}
      >
        <Icon name="gear" size={20} stroke={settingsActive ? 2.2 : 1.8} />
        <span>Settings</span>
      </button>
    </nav>
  );
}

export default Sidebar;
