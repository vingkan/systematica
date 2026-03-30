import { useState, useReducer } from 'react';
import { gameReducer } from './reducer';
import { createGame } from './engine/game';
import { StartScreen } from './components/StartScreen';
import { GameBoard } from './components/GameBoard';
import { ScoreDisplay } from './components/ScoreDisplay';
import { GameLog } from './components/GameLog';
import RuleBook from './components/RuleBook';
import { PassAndPlay } from './components/PassAndPlay';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createGame());
  const [showRuleBook, setShowRuleBook] = useState(false);
  const [showPassScreen, setShowPassScreen] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const handleEndServerTurn = () => {
    setPendingPhase('client-turn');
    setShowPassScreen(true);
  };

  const handleEndClientTurn = () => {
    dispatch({ type: 'END_CLIENT_TURN' });
  };

  const handlePassComplete = () => {
    if (pendingPhase === 'client-turn') {
      dispatch({ type: 'END_SERVER_TURN' });
    }
    setShowPassScreen(false);
    setPendingPhase(null);
  };

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleRestart = () => {
    dispatch({ type: 'RESTART' });
    setGameStarted(false);
  };

  if (showPassScreen) {
    return (
      <PassAndPlay
        nextPlayer={pendingPhase === 'client-turn' ? 'client' : 'server'}
        onReady={handlePassComplete}
      />
    );
  }

  if (!gameStarted) {
    return (
      <div style={{ position: 'relative' }}>
        <StartScreen onStart={handleStartGame} />
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
        <RuleBook isOpen={showRuleBook} onClose={() => setShowRuleBook(false)} />
      </div>
    );
  }

  if (state.phase === 'game-over') {
    return (
      <>
        <ScoreDisplay state={state} onRestart={handleRestart} />
        <GameLog />
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <GameBoard
          state={state}
          dispatch={dispatch}
          onEndServerTurn={handleEndServerTurn}
          onEndClientTurn={handleEndClientTurn}
        />
        <button
          className="btn"
          onClick={() => setShowRuleBook(true)}
          style={{
            position: 'fixed',
            top: 8,
            right: 16,
            zIndex: 50,
            fontSize: 11,
            padding: '6px 14px',
          }}
        >
          Rules
        </button>
      </div>
      <GameLog />
      <RuleBook isOpen={showRuleBook} onClose={() => setShowRuleBook(false)} />
    </>
  );
}
