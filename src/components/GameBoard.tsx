import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { PhaseBar } from './PhaseBar';
import { ServerArchitecture } from './ServerArchitecture';
import { ClientHand } from './ClientHand';
import { TurnControls } from './TurnControls';

interface GameBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameBoard({ state, dispatch }: GameBoardProps) {
  return (
    <div className="game-board">
      <PhaseBar state={state} />

      <div className="play-area">
        <ServerArchitecture state={state} dispatch={dispatch} />
        <div className="play-divider" />
        <ClientHand state={state} dispatch={dispatch} />
      </div>

      <TurnControls state={state} dispatch={dispatch} />
    </div>
  );
}
