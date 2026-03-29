import type { GameState } from '../types';
import type { GameAction } from '../reducer';

interface TurnControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function TurnControls({ state, dispatch }: TurnControlsProps) {
  const isServer = state.activePlayer === 'server';

  const handleEndTurn = () => {
    if (isServer) {
      dispatch({ type: 'END_SERVER_TURN' });
    } else {
      dispatch({ type: 'END_CLIENT_TURN' });
    }
  };

  return (
    <div className="turn-controls">
      <span className="active-player-label">
        {isServer ? '// server turn: add or remove 1 card, then end turn' : `// client turn: play up to ${state.turnState.cardLimit} cards`}
      </span>
      <button className="btn primary" onClick={handleEndTurn}>
        End {isServer ? 'Server' : 'Client'} Turn
      </button>
    </div>
  );
}
