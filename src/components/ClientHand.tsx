import type { GameState, RequestType, EffectType } from '../types';
import type { GameAction } from '../reducer';
import { RequestCard } from './Card';
import { addLog } from './GameLog';

interface ClientHandProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const REQUEST_NAMES: Record<string, string> = {
  'view-event': 'View Event',
  'hold-ticket': 'Hold Ticket',
  'purchase-ticket': 'Purchase Ticket',
};

export function ClientHand({ state, dispatch }: ClientHandProps) {
  const isClientTurn = state.activePlayer === 'client';
  const canPlay = isClientTurn && state.turnState.cardsPlayedThisTurn < state.turnState.cardLimit;

  const requestTypes: RequestType[] = ['view-event', 'hold-ticket', 'purchase-ticket'];
  const effectTypes: EffectType[] = ['stampeding-herd', 'race-condition', 'payment-error'];

  const handlePlayRequest = (type: RequestType) => {
    if (!canPlay) return;
    dispatch({ type: 'PLAY_REQUEST', requestType: type });

    // Log feedback based on what the request name is
    const name = REQUEST_NAMES[type] || type;
    addLog(`Played ${name} → routed to LB`, 'info');
  };

  const handlePlayEffect = (type: EffectType) => {
    if (type === 'stampeding-herd') {
      dispatch({ type: 'PLAY_EFFECT', effectType: type });
      addLog('Stampeding Herd! Card limit +10 this turn', 'warning');
    } else if (type === 'race-condition') {
      const holdTickets = state.requests.filter(
        r => r.type === 'hold-ticket' && r.status === 'active',
      );
      if (holdTickets.length >= 2) {
        dispatch({
          type: 'PLAY_EFFECT',
          effectType: type,
          targets: [holdTickets[0].id, holdTickets[1].id],
        });
        addLog('Race Condition! 2 Hold Tickets failed', 'error');
      } else {
        addLog('Need 2 active Hold Tickets for Race Condition', 'warning');
      }
    } else if (type === 'payment-error') {
      const purchase = state.requests.find(
        r => r.type === 'purchase-ticket' && r.status === 'active' && !r.effectAttached,
      );
      if (purchase) {
        dispatch({ type: 'PLAY_EFFECT', effectType: type, targets: [purchase.id] });
        addLog('Payment Error attached to Purchase Ticket', 'error');
      } else {
        addLog('No active Purchase Ticket to attach Payment Error', 'warning');
      }
    }
  };

  return (
    <div className="client-side">
      <div className="side-label">
        client deck // ticket booking
      </div>

      {/* Turn status */}
      {isClientTurn && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--request)',
          marginBottom: 'var(--sp-sm)',
          padding: '4px 8px',
          background: 'var(--request-bg)',
          border: '1px solid var(--request-border)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
        }}>
          Your turn: click a card to play it ({state.turnState.cardsPlayedThisTurn}/{state.turnState.cardLimit} played)
        </div>
      )}

      {!isClientTurn && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 'var(--sp-sm)',
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--grid-line-major)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
        }}>
          Waiting for server player...
        </div>
      )}

      <div className="client-hand">
        {requestTypes.map(type => {
          const entry = state.clientDeck.find(e => e.type === type);
          if (!entry || entry.remaining <= 0) return null;
          return (
            <RequestCard
              key={type}
              requestType={type}
              remaining={entry.remaining}
              onClick={() => handlePlayRequest(type)}
              disabled={!canPlay}
            />
          );
        })}

        {effectTypes.map(type => {
          const entry = state.clientDeck.find(e => e.type === type);
          if (!entry || entry.remaining <= 0) return null;

          const canPlayEffect = canPlay && (() => {
            if (type === 'stampeding-herd') return state.turnState.cardsPlayedThisTurn === 0;
            if (type === 'race-condition') {
              return state.requests.filter(r => r.type === 'hold-ticket' && r.status === 'active').length >= 2;
            }
            if (type === 'payment-error') {
              return state.requests.some(r => r.type === 'purchase-ticket' && r.status === 'active' && !r.effectAttached);
            }
            return true;
          })();

          return (
            <RequestCard
              key={type}
              requestType={type}
              remaining={entry.remaining}
              onClick={() => handlePlayEffect(type)}
              disabled={!canPlayEffect}
            />
          );
        })}
      </div>

      {/* Active requests with location details */}
      {state.requests.filter(r => r.status === 'active').length > 0 && (
        <div className="played-area">
          <div className="played-label">
            active requests ({state.requests.filter(r => r.status === 'active').length})
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {state.requests.filter(r => r.status === 'active').map(req => {
              const loc = req.location === 'lb-queue' ? 'queued' : 'routing';
              return (
                <span key={req.id} className="request-token request" title={`Turn ${req.turnPlayed}, at: ${req.location}`}>
                  {req.type.split('-').map(w => w[0].toUpperCase()).join('')}
                  {req.effectAttached === 'payment-error' && ' !'}
                  <span style={{ opacity: 0.5, marginLeft: 2 }}>
                    {loc}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary of completed/failed */}
      {(state.completedRequests.length > 0 || state.failedRequests.length > 0) && (
        <div style={{
          marginTop: 'var(--sp-sm)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 'var(--sp-md)',
        }}>
          {state.completedRequests.length > 0 && (
            <span style={{ color: 'var(--success)' }}>
              {state.completedRequests.length} completed
            </span>
          )}
          {state.failedRequests.length > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              {state.failedRequests.length} failed
            </span>
          )}
        </div>
      )}
    </div>
  );
}
