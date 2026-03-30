import { useState, useCallback } from 'react';
import type { GameState } from '../engine/types';
import type { GameAction } from '../reducer';
import { PhaseBar } from './PhaseBar';
import { ServerBoard } from './ServerBoard';
import { ClientBoard } from './ClientBoard';
import { TurnControls } from './TurnControls';
import { ResolutionTracker } from './ResolutionTracker';

interface GameBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onEndServerTurn: () => void;
  onEndClientTurn: () => void;
}

export function GameBoard({ state, dispatch, onEndServerTurn, onEndClientTurn }: GameBoardProps) {
  const [flashCardId, setFlashCardId] = useState<string | null>(null);
  const [routingPath, setRoutingPath] = useState<string[]>([]);
  const [nextTargetCardId, setNextTargetCardId] = useState<string | null>(null);
  // Store the step callback so ServerBoard can trigger it
  const [onStepFn, setOnStepFn] = useState<(() => void) | null>(null);

  const handleFlashCard = useCallback((instanceId: string) => {
    setFlashCardId(instanceId);
    setTimeout(() => setFlashCardId(null), 600);
  }, []);

  const handleSetRoutingPath = useCallback((path: string[]) => {
    setRoutingPath(path);
  }, []);

  const handleSetNextTarget = useCallback((cardId: string | null, stepFn: (() => void) | null) => {
    setNextTargetCardId(cardId);
    setOnStepFn(() => stepFn);
  }, []);

  const handleServerCardClick = useCallback((instanceId: string) => {
    if (instanceId === nextTargetCardId && onStepFn) {
      onStepFn();
    }
  }, [nextTargetCardId, onStepFn]);

  // Clear routing state when leaving resolution
  if (state.phase !== 'resolution' && routingPath.length > 0) {
    setRoutingPath([]);
    setNextTargetCardId(null);
    setOnStepFn(null);
  }

  return (
    <div className="game-board">
      <PhaseBar state={state} />

      <div className="play-area">
        <div className="server-side">
          <ServerBoard
            state={state}
            dispatch={dispatch}
            flashCardId={flashCardId}
            routingPath={routingPath}
            nextTargetCardId={nextTargetCardId}
            onServerCardClick={handleServerCardClick}
          />
        </div>
        <div className="play-divider" />
        <div className="client-side">
          {state.phase === 'resolution' ? (
            <ResolutionTracker
              state={state}
              dispatch={dispatch}
              onFlashCard={handleFlashCard}
              onSetRoutingPath={handleSetRoutingPath}
              onSetNextTarget={handleSetNextTarget}
            />
          ) : (
            <ClientBoard state={state} dispatch={dispatch} />
          )}
        </div>
      </div>

      <TurnControls
        state={state}
        dispatch={dispatch}
        onEndServerTurn={onEndServerTurn}
        onEndClientTurn={onEndClientTurn}
      />
    </div>
  );
}
