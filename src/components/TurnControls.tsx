import type { GameState } from '../types';
import type { GameAction } from '../reducer';

interface TurnControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function TurnControls({ state, dispatch }: TurnControlsProps) {
  const isServer = state.activePlayer === 'server';
  const isRouting = state.routingContext != null;

  const handleEndTurn = () => {
    if (isServer) {
      dispatch({ type: 'END_SERVER_TURN' });
    } else {
      dispatch({ type: 'END_CLIENT_TURN' });
    }
  };

  // Don't show end turn during routing
  if (isRouting) return null;

  return (
    <div className="turn-controls">
      <span className="active-player-label">
        {isServer
          ? '// server turn: add, remove, or move 1 card, then end turn'
          : `// client turn: play up to ${state.turnState.cardLimit} cards`}
      </span>
      <button className="btn primary" onClick={handleEndTurn}>
        End {isServer ? 'Server' : 'Client'} Turn
      </button>
    </div>
  );
}
