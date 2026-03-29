import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { PhaseBar } from './PhaseBar';
import { ServerArchitecture } from './ServerArchitecture';
import { ClientHand } from './ClientHand';
import { TurnControls } from './TurnControls';
import { ResolutionTracker } from './ResolutionTracker';

interface GameBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameBoard({ state, dispatch }: GameBoardProps) {
  const isRouting = state.routingContext != null;
  const ctx = state.routingContext;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance routing for non-interactive states
  useEffect(() => {
    if (!ctx) return;

    // States that auto-advance after 300ms
    const autoAdvanceStates = ['AT_APP', 'AT_STORAGE', 'AT_PAYMENT'];
    if (autoAdvanceStates.includes(ctx.state)) {
      autoAdvanceTimer.current = setTimeout(() => {
        dispatch({ type: 'ADVANCE_ROUTING' });
      }, 300);
    }

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, [ctx?.state, ctx?.requestId, ctx?.steps.length, dispatch]);

  // Click-to-skip: advance through auto-steps instantly
  const handleBoardClick = () => {
    if (!ctx) return;
    const terminalStates = ['COMPLETED', 'FAILED', 'WAITING_AT_LB'];
    if (terminalStates.includes(ctx.state)) {
      // Clear the routing context
      dispatch({ type: 'ADVANCE_ROUTING' });
      return;
    }
    // Skip auto-advancing steps
    const autoStates = ['AT_APP', 'AT_STORAGE', 'AT_PAYMENT'];
    if (autoStates.includes(ctx.state)) {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
      dispatch({ type: 'ADVANCE_ROUTING' });
    }
  };

  return (
    <div className="game-board" onClick={handleBoardClick}>
      <PhaseBar state={state} />

      <div className="play-area">
        <ServerArchitecture state={state} dispatch={dispatch} />
        <div className="play-divider" />
        {isRouting && ctx ? (
          <div className="client-side">
            <div className="side-label">resolving request</div>
            <ResolutionTracker routingContext={ctx} />
          </div>
        ) : (
          <ClientHand state={state} dispatch={dispatch} />
        )}
      </div>

      <TurnControls state={state} dispatch={dispatch} />
    </div>
  );
}
