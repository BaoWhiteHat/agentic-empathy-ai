'use client';
// components/screens/Settings.tsx — accessible personalisation (Tweaks) + support/account.
// Wired to TweaksContext. WCAG 2.2 AA-minded: fieldset/legend grouping, roving
// arrow-key radio navigation, aria-pressed/aria-checked state, ≥44px targets,
// a polite live region, contrast-checked accent, and a live type preview.
import React, { useRef, useState } from 'react';
import { IconBadge, Toggle, Button, type Tone } from '../ui/primitives';
import { useTweaks, type TweaksState } from '../../context/TweaksContext';
import { getContrastRatio, passesAA, formatRatio } from '../../utils/contrastCheck';

interface SettingsProps {
  name: string;
  onConsentReview: () => void;
  onOpenSafety: () => void;
  onLogout: () => void;
}

/* ── Approx. background hex for the active theme, for contrast checking ── */
function backgroundHex(darkMode: boolean, colorMode: string): string {
  if (colorMode === 'high-contrast') return '#000000';
  return darkMode ? '#181D17' : '#F3F7EE';
}

/* ── Labelled card section ── */
function PrefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <p className="label" style={{ margin: '0 0 12px' }}>{title}</p>
      <div className="card" style={{ padding: '18px 22px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
    </div>
  );
}

/* ── Accessible segmented radio group (fieldset/legend + roving tabindex) ── */
interface Opt<T extends string> { value: T; label: string; ariaLabel?: string }
function OptionGroup<T extends string>({ legend, value, options, onChange, hint }: { legend: string; value: T; options: Opt<T>[]; onChange: (v: T) => void; hint?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKeyDown = (e: React.KeyboardEvent) => {
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!fwd && !back) return;
    e.preventDefault();
    const next = (idx + (fwd ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}>
      <legend style={{ padding: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 9 }}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} onKeyDown={onKeyDown} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              role="radio"
              aria-checked={on}
              aria-label={o.ariaLabel || o.label}
              tabIndex={i === idx ? 0 : -1}
              onClick={() => onChange(o.value)}
              style={{
                minWidth: 44, minHeight: 44, padding: '0 16px',
                borderRadius: 'var(--r-sm)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                background: on ? 'var(--sage-tint)' : 'var(--surface-2)',
                color: on ? 'var(--sage-deep)' : 'var(--ink-soft)',
                fontWeight: on ? 700 : 600, fontSize: 13.5, transition: 'all .15s var(--ease)',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.45 }}>{hint}</p>}
    </fieldset>
  );
}

/* ── Toggle row (label + switch), ≥44px row ── */
function ToggleRow({ title, desc, value, onChange }: { title: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 44 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle on={value} onChange={onChange} tone="var(--accent)" />
    </div>
  );
}

/* ── Generic row used by Support / Account ── */
function Row({ icon, tone, title, desc, control, last }: { icon: string; tone?: Tone; title: string; desc?: string; control: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '18px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <IconBadge name={icon} tone={tone || 'neutral'} size={38} iconSize={18} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</div>
        {desc && <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 }}>{desc}</div>}
      </div>
      {control}
    </div>
  );
}

const ACCENTS: { hex: string; name: string }[] = [
  { hex: '#4A9B7F', name: 'Sea green' },
  { hex: '#2E9E6E', name: 'Forest green' },
  { hex: '#3F8FA8', name: 'Teal' },
  { hex: '#C77B5E', name: 'Clay' },
  { hex: '#87859F', name: 'Lavender' },
  { hex: '#CCA24F', name: 'Gold' },
];

export function SettingsScreen({ onOpenSafety, onLogout }: SettingsProps) {
  const { tweaks, set, resetToDefaults } = useTweaks();
  const [lastChanged, setLastChanged] = useState('');

  // Update a tweak and announce it to the live region.
  function update<K extends keyof TweaksState>(key: K, value: TweaksState[K], label: string) {
    set(key, value);
    setLastChanged(`${label} updated`);
  }

  const bgHex = backgroundHex(tweaks.darkMode, tweaks.colorMode);
  const accentRatio = getContrastRatio(tweaks.accent, bgHex);
  const accentFails = !passesAA(tweaks.accent, bgHex);

  return (
    <div className="no-scrollbar" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 64px' }}>
        <h1 className="serif" style={{ fontSize: 32, margin: '0 0 4px' }}>Settings</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 32 }}>Make this space fit you. Every change is saved on your device.</p>

        {/* Polite live region — announces each change to screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">{lastChanged}</div>

        {/* ── DISPLAY ── */}
        <PrefSection title="Display">
          <OptionGroup legend="Text size" value={tweaks.textSize}
            options={[
              { value: 'S', label: 'S', ariaLabel: 'Small text' },
              { value: 'M', label: 'M', ariaLabel: 'Medium text' },
              { value: 'L', label: 'L', ariaLabel: 'Large text' },
              { value: 'XL', label: 'XL', ariaLabel: 'Extra large text' },
            ]}
            onChange={(v) => update('textSize', v, 'Text size')} />

          <OptionGroup legend="Font" value={tweaks.font}
            options={[
              { value: 'sans', label: 'Sans', ariaLabel: 'Sans-serif (Inter)' },
              { value: 'dyslexic', label: 'Dyslexic', ariaLabel: 'Dyslexia-friendly (OpenDyslexic)' },
              { value: 'serif', label: 'Serif', ariaLabel: 'Serif (Newsreader)' },
            ]}
            onChange={(v) => update('font', v, 'Font')} />

          <OptionGroup legend="Line spacing" value={tweaks.lineSpacing}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'relaxed', label: 'Relaxed' },
            ]}
            onChange={(v) => update('lineSpacing', v, 'Line spacing')} />

          <OptionGroup legend="Letter spacing" value={tweaks.letterSpacing}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'wide', label: 'Wide', ariaLabel: 'Wide letter spacing (helps dyslexia)' },
            ]}
            onChange={(v) => update('letterSpacing', v, 'Letter spacing')} />

          {/* Live preview — reflects the CSS vars in real time */}
          <div aria-label="Font preview" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '14px 16px' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', lineHeight: 'var(--line-height)', letterSpacing: 'var(--letter-spacing)', color: 'var(--ink)' }}>
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </PrefSection>

        {/* ── MOTION & COLOUR ── */}
        <PrefSection title="Motion & colour">
          <ToggleRow title="Reduce animations" desc="Calms movement across the app. Also follows your device setting." value={tweaks.reduceMotion} onChange={(v) => update('reduceMotion', v, 'Reduce animations')} />

          <ToggleRow title="Dark mode" desc="A warmer, dimmer space for evenings." value={tweaks.darkMode} onChange={(v) => update('darkMode', v, 'Dark mode')} />

          <OptionGroup legend="Colour mode" value={tweaks.colorMode}
            options={[
              { value: 'calm', label: 'Calm', ariaLabel: 'Calm (muted, gentle on the senses)' },
              { value: 'vibrant', label: 'Vibrant' },
              { value: 'high-contrast', label: 'High contrast' },
            ]}
            onChange={(v) => update('colorMode', v, 'Colour mode')} />

          <fieldset style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}>
            <legend style={{ padding: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 9 }}>Accent colour</legend>
            <div role="radiogroup" aria-label="Accent colour" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {ACCENTS.map((a) => {
                const on = tweaks.accent.toLowerCase() === a.hex.toLowerCase();
                return (
                  <button key={a.hex} role="radio" aria-checked={on} aria-label={`Accent colour: ${a.name}`} onClick={() => update('accent', a.hex, 'Accent colour')}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: a.hex, border: on ? '3px solid var(--ink)' : '1px solid var(--line)', boxShadow: on ? 'var(--shadow-soft)' : 'none', flexShrink: 0 }} />
                );
              })}
              {/* Custom colour */}
              <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', border: '1px dashed var(--line-strong)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                <span aria-hidden style={{ fontSize: 18, color: 'var(--ink-faint)' }}>+</span>
                <input type="color" aria-label="Custom accent colour" value={tweaks.accent}
                  onChange={(e) => update('accent', e.target.value, 'Accent colour')}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              </label>
            </div>
            {/* Contrast warning — warns, never blocks */}
            {accentFails && (
              <p role="alert" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--care-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚠️ Low contrast ({formatRatio(accentRatio)}:1). Minimum 4.5:1 recommended for readability.
              </p>
            )}
          </fieldset>
        </PrefSection>

        {/* ── FOCUS & COGNITION ── */}
        <PrefSection title="Focus & clarity">
          <ToggleRow title="Focus mode" desc="Hides non-essential UI — sidebar labels, badges and chrome." value={tweaks.focusMode} onChange={(v) => update('focusMode', v, 'Focus mode')} />

          <OptionGroup legend="Explanation detail" value={tweaks.explainDetail}
            options={[
              { value: 'plain', label: 'Plain' },
              { value: 'plain+how', label: 'Plain + how', ariaLabel: 'Plain language plus how it works' },
            ]}
            hint="Affects how insights are explained."
            onChange={(v) => update('explainDetail', v, 'Explanation detail')} />

          <OptionGroup legend="Dashboard" value={tweaks.dashboard}
            options={[
              { value: 'calm', label: 'Calm', ariaLabel: 'Calm (single column, spacious)' },
              { value: 'bento', label: 'Bento', ariaLabel: 'Bento (grid, more at a glance)' },
            ]}
            onChange={(v) => update('dashboard', v, 'Dashboard')} />
        </PrefSection>

        {/* ── LAYOUT VARIANTS ── */}
        <PrefSection title="Layout">
          <OptionGroup legend="Chat style" value={tweaks.chatStyle}
            options={[
              { value: 'bubbles', label: 'Bubbles' },
              { value: 'minimal', label: 'Minimal' },
            ]}
            onChange={(v) => update('chatStyle', v, 'Chat style')} />

          <OptionGroup legend="Voice screen" value={tweaks.voiceScreen}
            options={[
              { value: 'idle', label: 'Idle', ariaLabel: 'Idle (mic only)' },
              { value: 'live-transcript', label: 'Transcript', ariaLabel: 'Live transcript' },
            ]}
            onChange={(v) => update('voiceScreen', v, 'Voice screen')} />
        </PrefSection>

        {/* FUTURE WORK — intentionally NOT exposed as controls yet:
            • Mood check-in style (weather/emoji/slider/words) — hardcoded to "weather" in SoulMateApp.
            • Onboarding style (guided/conversational) — hardcoded to "guided" in SoulMateApp.
            Both were dropped from TweaksState during the personalisation migration because
            changing them had no visible effect. Re-add here (and to TweaksState) once the
            underlying variants are wired, to avoid broken-trust controls. */}

        {/* ── SUPPORT ── */}
        <PrefSection title="Support">
          <Row icon="shieldHeart" tone="care" title="Support resources" desc="Crisis lines and grounding tools, any time you need them." control={<Button variant="soft" size="sm" iconRight="chevR" onClick={onOpenSafety}>Open</Button>} last />
        </PrefSection>

        {/* ── ACCOUNT ── */}
        <PrefSection title="Account">
          <Row icon="logout" tone="neutral" title="Sign out" desc="Clear your session and return to the start." control={<Button variant="soft" size="sm" onClick={onLogout}>Sign out</Button>} last />
        </PrefSection>

        <Button variant="ghost" full onClick={() => { resetToDefaults(); setLastChanged('Settings reset to defaults'); }} style={{ marginTop: 4 }}>
          Reset to defaults
        </Button>

        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 18 }}>SoulMate · a non-clinical companion · not a substitute for professional care</p>
      </div>
    </div>
  );
}
