import { useState, useReducer } from 'react';
import { gameReducer } from './reducer';
import { createInitialGameState } from './engine/build';
import { BuildPhase } from './components/BuildPhase';
import { GameBoard } from './components/GameBoard';
import { ScoreDisplay } from './components/ScoreDisplay';
import { GameLog } from './components/GameLog';
import RuleBook from './components/RuleBook';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [showRuleBook, setShowRuleBook] = useState(false);

  return (
    <>
      {state.phase === 'build' && (
        <div style={{ position: 'relative' }}>
          <BuildPhase state={state} dispatch={dispatch} />
          <button
            className="btn"
            onClick={() => setShowRuleBook(true)}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 50,
              fontSize: 12,
              padding: '6px 14px',
            }}
          >
            How to Play
          </button>
        </div>
      )}
      {state.phase === 'game-over' && <ScoreDisplay state={state} dispatch={dispatch} />}
      {state.phase === 'play' && (
        <div style={{ position: 'relative' }}>
          <GameBoard state={state} dispatch={dispatch} />
          <button
            className="btn"
            onClick={() => setShowRuleBook(true)}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 50,
              fontSize: 11,
              padding: '4px 10px',
              opacity: 0.7,
            }}
          >
            Rules
          </button>
        </div>
      )}
      <GameLog />
      <RuleBook isOpen={showRuleBook} onClose={() => setShowRuleBook(false)} />
    </>
  );
}
