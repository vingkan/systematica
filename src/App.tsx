import { useReducer } from 'react';
import { gameReducer } from './reducer';
import { createInitialGameState } from './engine/build';
import { BuildPhase } from './components/BuildPhase';
import { GameBoard } from './components/GameBoard';
import { ScoreDisplay } from './components/ScoreDisplay';
import { GameLog } from './components/GameLog';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);

  return (
    <>
      {state.phase === 'build' && <BuildPhase state={state} dispatch={dispatch} />}
      {state.phase === 'game-over' && <ScoreDisplay state={state} dispatch={dispatch} />}
      {state.phase !== 'build' && state.phase !== 'game-over' && (
        <GameBoard state={state} dispatch={dispatch} />
      )}
      <GameLog />
    </>
  );
}
