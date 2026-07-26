'use client';
// components/screens/Memory.tsx — memory control (local state, front-end only)
import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, Toggle, type Tone } from '../ui/primitives';
import { ScreenScroll } from '../ui/ScreenScroll';

interface MemItem { id: number; t: string; d: string; on: boolean }
type MemKey = 'people' | 'facts' | 'themes';

const SEED_MEMORY: Record<MemKey, MemItem[]> = {
  people: [{ id: 1, t: 'Mai', d: 'Close friend you confide in', on: true }, { id: 2, t: 'Dad', d: 'Relationship feels distant lately', on: true }],
  facts: [{ id: 3, t: 'Final exams', d: 'Coming up this month — a big source of stress', on: true }, { id: 4, t: 'Lives away from home', d: 'Moved cities for university', on: true }, { id: 5, t: 'Loves early walks', d: 'Mornings by the river help you reset', on: true }],
  themes: [{ id: 6, t: 'Pressure to perform', d: 'A recurring theme in our talks', on: true }, { id: 7, t: 'Wanting to feel seen', d: 'Comes up around family', on: true }],
};

export function MemoryScreen() {
  const [mem, setMem] = useState(SEED_MEMORY);
  const groups: { key: MemKey; label: string; icon: string; tone: Tone }[] = [
    { key: 'people', label: 'People in your life', icon: 'heart', tone: 'clay' },
    { key: 'facts', label: 'Things about you', icon: 'bookmark', tone: 'sage' },
    { key: 'themes', label: 'Themes we return to', icon: 'waves', tone: 'lavender' },
  ];
  const toggle = (g: MemKey, id: number) => setMem((m) => ({ ...m, [g]: m[g].map((x) => x.id === id ? { ...x, on: !x.on } : x) }));
  const remove = (g: MemKey, id: number) => setMem((m) => ({ ...m, [g]: m[g].filter((x) => x.id !== id) }));
  const total = Object.values(mem).reduce((s, a) => s + a.length, 0);

  return (
    <ScreenScroll max={820}>
      <div className="memory-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>What SoulMate remembers</p>
          <h1 className="serif" style={{ fontSize: 32, margin: 0, lineHeight: 1.12 }}>Your memory, in your hands</h1>
        </div>
        <Button variant="outline" size="sm" icon="trash" style={{ color: 'var(--care)', borderColor: 'var(--care-soft)' }}>Clear everything</Button>
      </div>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, maxWidth: 600, marginBottom: 28 }}>{`Everything SoulMate has gathered to understand you better — ${total} items in plain language. Switch any off to make it forget, or remove it for good.`}</p>

      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <IconBadge name={g.icon} tone={g.tone} size={34} iconSize={16} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{g.label}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{`· ${mem[g.key].length}`}</span>
          </div>
          <div className="memory-card card" style={{ padding: '4px 20px', boxShadow: 'var(--shadow-soft)' }}>
            {mem[g.key].length === 0
              ? <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint)' }}>Nothing here — SoulMate will only remember what you allow.</div>
              : mem[g.key].map((item, i) => (
                <div className="memory-item" key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: i === mem[g.key].length - 1 ? 'none' : '1px solid var(--line)', opacity: item.on ? 1 : 0.5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{item.t}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{item.d}</div>
                  </div>
                  <button onClick={() => remove(g.key, item.id)} aria-label="Forget" style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', padding: 6, borderRadius: 8, display: 'flex' }}><Icon name="trash" size={16} /></button>
                  <Toggle on={item.on} onChange={() => toggle(g.key, item.id)} />
                </div>
              ))}
          </div>
        </div>
      ))}

      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        <Icon name="lock" size={18} style={{ color: 'var(--sage-deep)', flexShrink: 0 }} />
        These notes never leave your account. Forgetting something here means SoulMate truly lets it go.
      </div>
    </ScreenScroll>
  );
}
