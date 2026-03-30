import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { PhaseBar } from './PhaseBar';
import { ServerArchitecture } from './ServerArchitecture';
import { ClientHand } from './ClientHand';
import { TurnControls } from './TurnControls';
import { ResolutionTracker } from './ResolutionTracker';
import { ServerReactionPanel } from './ServerReactionPanel';

interface GameBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameBoard({ state, dispatch }: GameBoardProps) {
  const isRouting = state.routingContext != null;
  const ctx = state.routingContext;

  // Click-to-dismiss terminal states
  const handleBoardClick = () => {
    if (!ctx) return;
    const terminalStates = ['COMPLETED', 'FAILED', 'WAITING_AT_LB'];
    if (terminalStates.includes(ctx.state)) {
      dispatch({ type: 'ADVANCE_ROUTING' });
    }
    // No more auto-advancing — AT_APP (storage selection) and AT_LB (compute selection)
    // are both interactive and handled by card click handlers
  };

  return (
    <div className="game-board" onClick={handleBoardClick}>
      <PhaseBar state={state} />

      <div className="play-area">
        <ServerArchitecture state={state} dispatch={dispatch} />
        <div className="play-divider" />
        {isRouting && ctx ? (
          ctx.state === 'AWAITING_SERVER_REACTION' ? (
            <ServerReactionPanel state={state} dispatch={dispatch} />
          ) : (
            <div className="client-side">
              <div className="side-label">
                resolving request
                {state.batchContext && state.batchContext.batchSize > 1 && (
                  <span style={{ marginLeft: 8, color: 'var(--info)' }}>
                    ({state.batchContext.currentIndex}/{state.batchContext.batchSize})
                  </span>
                )}
              </div>
              <ResolutionTracker routingContext={ctx} />
            </div>
          )
        ) : (
          <ClientHand state={state} dispatch={dispatch} />
        )}
      </div>

      <TurnControls state={state} dispatch={dispatch} />
    </div>
  );
}
