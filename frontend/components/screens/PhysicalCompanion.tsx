export default function PhysicalCompanionScreen() {
  return (
    <div style={{
      maxWidth: 680,
      margin: '0 auto',
      padding: '48px 40px 64px',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--sage)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <rect x="9" y="9" width="6" height="6"/>
          <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
        </svg>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>
          Physical companion
        </h1>
      </div>
      <p style={{
        fontSize: 14,
        color: 'var(--ink-soft)',
        margin: '0 0 36px',
        lineHeight: 1.65,
      }}>
        Run SoulMate on real hardware — laptop mic, ESP32 speaker, and an OLED
        screen that shows live emotions.
      </p>

      {/* Hardware */}
      <p className="label" style={{ marginBottom: 12 }}>Hardware</p>
      <div className="card" style={{ marginBottom: 28 }}>
        {[
          { label: 'Board + audio + display', value: 'ESP32 · MAX98357A · SH1106 OLED' },
          { label: 'Serial port', value: 'COM5' },
          { label: 'Baud rate', value: '921600' },
          { label: 'Microphone', value: 'Laptop mic (default)' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 0',
            borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{row.label}</span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 12.5,
              color: 'var(--ink)',
              background: 'var(--surface-2)',
              padding: '2px 9px',
              borderRadius: 'var(--r-sm)',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Steps */}
      <p className="label" style={{ marginBottom: 14 }}>How to start</p>
      {[
        {
          n: 1,
          title: 'Navigate to the backend folder',
          sub: 'Open a terminal at the project root',
          cmd: 'cd backend',
        },
        {
          n: 2,
          title: 'Run the companion script',
          sub: 'The script connects to ESP32 on COM5 and starts the AI pipeline automatically',
          cmd: 'uv run python voice_companion.py',
        },
        {
          n: 3,
          title: 'Wait for the ready signal',
          sub: 'The terminal will confirm the ESP32 connection and "SoulMate" will appear on the OLED. You\'re good to go.',
          cmd: null,
        },
      ].map(step => (
        <div key={step.n} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--sage-tint)',
              color: 'var(--sage-deep)',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}>
              {step.n}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>
                {step.title}
              </p>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>
                {step.sub}
              </p>
              {step.cmd && (
                <code style={{
                  display: 'block',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-md)',
                  padding: '10px 14px',
                  marginTop: 10,
                  color: 'var(--ink)',
                  userSelect: 'all',
                }}>
                  {step.cmd}
                </code>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Controls */}
      <p className="label" style={{ marginBottom: 14, marginTop: 28 }}>Controls</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {[
          { key: 'SPACE', title: 'Push to talk', desc: 'Press to start recording, release to send' },
          { key: 'Q', title: 'Quit', desc: 'Closes the companion and frees COM5' },
        ].map(k => (
          <div key={k.key} style={{
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: k.key === 'SPACE' ? 13 : 18,
              fontWeight: 500,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-md)',
              color: 'var(--ink)',
              flexShrink: 0,
            }}>
              {k.key === 'SPACE' ? '␣' : k.key}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px', color: 'var(--ink)' }}>
                {k.title}
              </p>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
                {k.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.65, margin: 0 }}>
        No ESP32? The script falls back to laptop speakers via pygame.
        Set{' '}
        <code style={{ fontFamily: 'monospace', fontSize: 12 }}>COMPANION_USER_ID</code>
        {' '}in your{' '}
        <code style={{ fontFamily: 'monospace', fontSize: 12 }}>.env</code>
        {' '}to change the user name (default:{' '}
        <code style={{ fontFamily: 'monospace', fontSize: 12 }}>Ghostman</code>
        ).
      </p>
    </div>
  );
}