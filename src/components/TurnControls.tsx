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
          ? `// server turn: ${state.turnState.serverEnergy}E remaining | add (2E), remove (1E), move app (free)`
          : `// client turn: play up to ${state.turnState.cardLimit} cards`}
      </span>
      <button className="btn primary" onClick={handleEndTurn}>
        End {isServer ? 'Server' : 'Client'} Turn
      </button>
    </div>
  );
}
