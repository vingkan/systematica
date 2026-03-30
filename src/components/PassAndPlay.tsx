interface PassAndPlayProps {
  nextPlayer: 'server' | 'client';
  onReady: () => void;
}

export function PassAndPlay({ nextPlayer, onReady }: PassAndPlayProps) {
  const playerName = nextPlayer === 'server' ? 'Server Player' : 'Client Player';
  const color = nextPlayer === 'server' ? 'var(--compute)' : 'var(--request)';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-deep)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      gap: 24,
    }}>
      <div style={{
        fontFamily: 'Satoshi, sans-serif',
        fontSize: 36,
        fontWeight: 900,
        color,
      }}>
        Pass to {playerName}
      </div>
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 16,
        color: 'var(--text-secondary)',
        maxWidth: 400,
        textAlign: 'center',
      }}>
        {nextPlayer === 'client'
          ? 'The client player will place request cards face down. The server player should look away.'
          : 'The server player will review the board and make routing decisions.'}
      </div>
      <button
        className="btn"
        onClick={onReady}
        style={{
          marginTop: 16,
          fontSize: 18,
          padding: '12px 32px',
          background: color,
          color: 'var(--bg-deep)',
          border: 'none',
          fontFamily: 'Satoshi, sans-serif',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        I'm Ready
      </button>
    </div>
  );
}
