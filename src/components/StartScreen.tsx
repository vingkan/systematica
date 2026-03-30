interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="build-phase">
      {/* Grand title */}
      <div style={{
        fontFamily: "'Satoshi', sans-serif",
        fontWeight: 900,
        fontSize: 72,
        color: 'var(--text-primary)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        textAlign: 'center',
      }}>
        Systematica
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginTop: 8,
        textAlign: 'center',
      }}>
        Build Systems. Break Systems. Learn Systems.
      </div>

      {/* Scenario selection */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginTop: 48,
        marginBottom: 16,
      }}>
        Choose a Scenario
      </div>

      <div className="build-options">
        {/* Ticket Booking scenario */}
        <div className="build-option" onClick={onStart} style={{ maxWidth: 320 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'var(--request)',
            marginBottom: 8,
          }}>
            Scenario 01
          </div>
          <div className="build-option-title" style={{ color: 'var(--text-primary)', fontSize: 22 }}>
            Ticket Booking
          </div>
          <div className="build-option-desc" style={{ marginTop: 8 }}>
            A concert just announced. Thousands of fans are hitting your ticket system.
            Can your infrastructure handle the rush?
          </div>
          <div className="build-option-stats" style={{
            marginTop: 12,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            <span style={{ color: 'var(--compute)' }}>30 server cards</span>
            {' vs '}
            <span style={{ color: 'var(--request)' }}>30 client cards</span>
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            lineHeight: 1.8,
            color: 'var(--text-muted)',
          }}>
            <div><span style={{ color: 'var(--success)' }}>Value</span> {'>'} 50</div>
            <div><span style={{ color: 'var(--success)' }}>Uptime</span> {'>'} 95%</div>
            <div><span style={{ color: 'var(--success)' }}>Efficiency</span> {'<'} 8 pts/req</div>
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: 'var(--success)',
            fontWeight: 500,
          }}>
            Play Now
          </div>
        </div>

        {/* Coming soon scenario */}
        <div className="build-option" style={{
          maxWidth: 320,
          opacity: 0.4,
          cursor: 'not-allowed',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}>
            Scenario 02
          </div>
          <div className="build-option-title" style={{ color: 'var(--text-muted)', fontSize: 22 }}>
            Coming Soon
          </div>
          <div className="build-option-desc" style={{ marginTop: 8 }}>
            More scenarios are being designed. Each with unique card decks,
            traffic patterns, and system design challenges.
          </div>
        </div>
      </div>

    </div>
  );
}
