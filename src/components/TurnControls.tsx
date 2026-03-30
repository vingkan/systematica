import type { GameState } from '../engine/types';
import type { GameAction } from '../reducer';
import { isRequestCard } from '../engine/cards';

interface TurnControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onEndServerTurn: () => void;
  onEndClientTurn: () => void;
}

export function TurnControls({ state, onEndServerTurn, onEndClientTurn }: TurnControlsProps) {
  if (state.phase === 'resolution' || state.phase === 'game-over') return null;

  const cardsPerTurn = state.config.cardsPerTurn ?? 5;
  const requestCardsInDeck = state.clientDeck.filter(isRequestCard).length;
  const requiredCards = Math.min(cardsPerTurn, requestCardsInDeck + state.faceDownCards.length);
  const slotsRemaining = requiredCards - state.faceDownCards.length;
  const clientCanEnd = state.faceDownCards.length >= requiredCards;

  return (
    <div className="turn-controls">
      <span className="active-player-label">
        {state.phase === 'server-turn' ? 'Server is building...' : `Client: ${state.faceDownCards.length}/${cardsPerTurn} cards placed`}
      </span>
      {state.phase === 'server-turn' && (
        <button className="btn primary" onClick={onEndServerTurn}>
          End Server Turn
        </button>
      )}
      {state.phase === 'client-turn' && (
        <div style={{ position: 'relative', display: 'inline-block' }} className="tooltip-wrapper">
          <button
            className="btn primary"
            onClick={onEndClientTurn}
            disabled={!clientCanEnd}
          >
            End Client Turn
          </button>
          {!clientCanEnd && (
            <span style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 6,
              padding: '4px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--grid-line-major)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              Place {slotsRemaining} more request card{slotsRemaining !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
