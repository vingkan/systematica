import { useState } from 'react';
import type { GameState } from '../types';
import { ENERGY_COST_INTERRUPT } from '../types';
import { getCardDef } from '../cards';
import type { GameAction } from '../reducer';
import { addLog } from './GameLog';

interface ServerReactionPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ServerReactionPanel({ state, dispatch }: ServerReactionPanelProps) {
  const [selectedInterrupt, setSelectedInterrupt] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const energy = state.turnState.serverEnergy;
  const canInterrupt = energy >= ENERGY_COST_INTERRUPT;
  const hasCloudFunctionInReserve = state.reserve.includes('cloud-function');

  const computeCards = state.board.filter(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'compute';
  });

  const appCards = state.board.filter(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'application';
  });

  const handlePass = () => {
    dispatch({ type: 'SERVER_PASS_REACTION' });
    addLog('Server passes reaction', 'info');
    setSelectedInterrupt(null);
    setSelectedApp(null);
  };

  const handleAutoScale = () => {
    dispatch({ type: 'AUTO_SCALE' });
    addLog('Auto-Scale: spawned ephemeral Cloud Function', 'success');
  };

  const handleRateLimit = (computeInstanceId: string) => {
    dispatch({ type: 'RATE_LIMIT', computeInstanceId });
    const card = state.board.find(c => c.instanceId === computeInstanceId);
    addLog(`Rate Limit: halved ${card ? getCardDef(card.cardId).name : 'node'} capacity`, 'warning');
    setSelectedInterrupt(null);
  };

  const handleCircuitBreaker = (computeInstanceId: string) => {
    dispatch({ type: 'CIRCUIT_BREAKER', computeInstanceId });
    const card = state.board.find(c => c.instanceId === computeInstanceId);
    addLog(`Circuit Breaker: disabled ${card ? getCardDef(card.cardId).name : 'node'}`, 'error');
    setSelectedInterrupt(null);
  };

  const handleHotSwap = (appInstanceId: string, targetComputeId: string) => {
    dispatch({ type: 'HOT_SWAP', appInstanceId, targetComputeInstanceId: targetComputeId });
    const app = state.board.find(c => c.instanceId === appInstanceId);
    const target = state.board.find(c => c.instanceId === targetComputeId);
    addLog(`Hot Swap: moved ${app ? getCardDef(app.cardId).name : 'app'} → ${target ? getCardDef(target.cardId).name : 'node'}`, 'success');
    setSelectedInterrupt(null);
    setSelectedApp(null);
  };

  const chipStyle = (enabled: boolean, active: boolean = false) => ({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    padding: '6px 12px',
    background: active ? 'var(--info)' : enabled ? 'var(--bg-surface)' : 'var(--bg-deep)',
    color: active ? '#fff' : enabled ? 'var(--text-primary)' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--info)' : enabled ? 'var(--grid-line-major)' : 'var(--grid-line)'}`,
    borderRadius: 'var(--radius-md)',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
  });

  return (
    <div className="client-side">
      <div className="side-label">server reaction</div>

      {/* Energy display */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: 'var(--info)',
        marginBottom: 'var(--sp-sm)',
        padding: '6px 10px',
        background: 'rgba(74, 158, 206, 0.08)',
        border: '1px solid rgba(74, 158, 206, 0.2)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center',
      }}>
        energy: {energy} | cost per interrupt: {ENERGY_COST_INTERRUPT}
      </div>

      {/* Interrupt buttons */}
      {!selectedInterrupt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
          <button
            style={chipStyle(canInterrupt && hasCloudFunctionInReserve)}
            onClick={() => canInterrupt && hasCloudFunctionInReserve && handleAutoScale()}
          >
            Auto-Scale (1E) — spawn ephemeral Cloud Function
          </button>

          <button
            style={chipStyle(canInterrupt && computeCards.length > 0)}
            onClick={() => canInterrupt && computeCards.length > 0 && setSelectedInterrupt('RATE_LIMIT')}
          >
            Rate Limit (1E) — halve a node's capacity
          </button>

          <button
            style={chipStyle(canInterrupt && computeCards.length > 0)}
            onClick={() => canInterrupt && computeCards.length > 0 && setSelectedInterrupt('CIRCUIT_BREAKER')}
          >
            Circuit Breaker (1E) — disable a node
          </button>

          <button
            style={chipStyle(canInterrupt && appCards.length > 0 && computeCards.length > 1)}
            onClick={() => canInterrupt && appCards.length > 0 && computeCards.length > 1 && setSelectedInterrupt('HOT_SWAP')}
          >
            Hot Swap (1E) — move an app between nodes
          </button>
        </div>
      )}

      {/* Node picker for Rate Limit / Circuit Breaker */}
      {(selectedInterrupt === 'RATE_LIMIT' || selectedInterrupt === 'CIRCUIT_BREAKER') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Select compute node for {selectedInterrupt === 'RATE_LIMIT' ? 'Rate Limit' : 'Circuit Breaker'}:
          </div>
          {computeCards.map(c => {
            const def = getCardDef(c.cardId);
            const disabled = c.disabledUntilTurn != null && c.disabledUntilTurn >= state.currentTurn;
            return (
              <button
                key={c.instanceId}
                style={chipStyle(!disabled)}
                onClick={() => {
                  if (disabled) return;
                  if (selectedInterrupt === 'RATE_LIMIT') handleRateLimit(c.instanceId);
                  else handleCircuitBreaker(c.instanceId);
                }}
              >
                {def.name} {disabled ? '(disabled)' : `(${c.capacityModifier ?? def.capacity} cap)`}
              </button>
            );
          })}
          <button style={chipStyle(true)} onClick={() => setSelectedInterrupt(null)}>
            cancel
          </button>
        </div>
      )}

      {/* Hot Swap: step 1 = pick app, step 2 = pick target compute */}
      {selectedInterrupt === 'HOT_SWAP' && !selectedApp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Select app to move:
          </div>
          {appCards.map(c => (
            <button key={c.instanceId} style={chipStyle(true)} onClick={() => setSelectedApp(c.instanceId)}>
              {getCardDef(c.cardId).name}
            </button>
          ))}
          <button style={chipStyle(true)} onClick={() => setSelectedInterrupt(null)}>
            cancel
          </button>
        </div>
      )}

      {selectedInterrupt === 'HOT_SWAP' && selectedApp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Select target compute node:
          </div>
          {computeCards.map(c => {
            const def = getCardDef(c.cardId);
            return (
              <button key={c.instanceId} style={chipStyle(true)} onClick={() => handleHotSwap(selectedApp, c.instanceId)}>
                {def.name}
              </button>
            );
          })}
          <button style={chipStyle(true)} onClick={() => { setSelectedApp(null); setSelectedInterrupt(null); }}>
            cancel
          </button>
        </div>
      )}

      {/* Pass button — always available */}
      <button
        className="btn primary"
        onClick={handlePass}
        style={{ marginTop: 'var(--sp-sm)', width: '100%' }}
      >
        Pass (continue routing)
      </button>
    </div>
  );
}
