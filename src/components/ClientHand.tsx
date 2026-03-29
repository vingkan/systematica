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
  const isRouting = state.routingContext != null;
  const canPlay = isClientTurn && !isRouting && state.turnState.cardsPlayedThisTurn < state.turnState.cardLimit;
  const selectedEffect = state.selectedEffect;

  const requestTypes: RequestType[] = ['view-event', 'hold-ticket', 'purchase-ticket'];
  const effectTypes: EffectType[] = ['stampeding-herd', 'race-condition', 'payment-error'];

  // Count pending attachments per request type
  const attachmentsFor = (type: RequestType) =>
    state.effectAttachments.filter(a => a.requestType === type).length;

  const handlePlayRequest = (type: RequestType) => {
    if (!canPlay) return;

    // If an effect is selected, attach it to this request card instead of playing
    if (selectedEffect) {
      const validTarget =
        (selectedEffect === 'race-condition' && type === 'hold-ticket') ||
        (selectedEffect === 'payment-error' && type === 'purchase-ticket');
      if (validTarget) {
        dispatch({ type: 'ATTACH_EFFECT', requestType: type });
        addLog(`${selectedEffect === 'race-condition' ? 'Race Condition' : 'Payment Error'} attached to ${REQUEST_NAMES[type]}`, 'warning');
        return;
      }
    }

    dispatch({ type: 'PLAY_REQUEST', requestType: type });
    const name = REQUEST_NAMES[type] || type;
    const attachment = state.effectAttachments.find(a => a.requestType === type);
    if (attachment) {
      addLog(`Played ${name} with ${attachment.effectType === 'race-condition' ? 'Race Condition' : 'Payment Error'} attached!`, 'error');
    } else {
      addLog(`Played ${name} → routed to LB`, 'info');
    }
  };

  const handlePlayEffect = (type: EffectType) => {
    if (type === 'stampeding-herd') {
      dispatch({ type: 'PLAY_STAMPEDING_HERD' });
      addLog('Stampeding Herd! Card limit +10 this turn', 'warning');
    } else {
      // Toggle selection for attachment-type effects
      dispatch({ type: 'SELECT_EFFECT', effectType: type });
      if (selectedEffect === type) {
        addLog('Effect deselected', 'info');
      } else {
        const targetType = type === 'race-condition' ? 'Hold Ticket' : 'Purchase Ticket';
        addLog(`Select a ${targetType} card to attach ${type === 'race-condition' ? 'Race Condition' : 'Payment Error'}`, 'warning');
      }
    }
  };

  // Determine which request cards should be highlighted for effect attachment
  const isHighlightedForAttachment = (type: RequestType): boolean => {
    if (!selectedEffect) return false;
    if (selectedEffect === 'race-condition' && type === 'hold-ticket') return true;
    if (selectedEffect === 'payment-error' && type === 'purchase-ticket') return true;
    return false;
  };

  return (
    <div className="client-side">
      <div className="side-label">
        client deck // ticket booking
      </div>

      {/* Turn status */}
      {isClientTurn && !selectedEffect && (
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

      {/* Effect attachment mode indicator */}
      {selectedEffect && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--effect)',
          marginBottom: 'var(--sp-sm)',
          padding: '6px 8px',
          background: 'var(--effect-bg)',
          border: '1px solid var(--effect-border)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
        }}>
          {selectedEffect === 'race-condition'
            ? `Click a Hold Ticket to attach Race Condition (${state.effectAttachments.filter(a => a.effectType === 'race-condition').length}/2 attached)`
            : 'Click a Purchase Ticket to attach Payment Error'}
          <br />
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Click the effect card again to cancel
          </span>
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
          const highlighted = isHighlightedForAttachment(type);
          const numAttachments = attachmentsFor(type);

          return (
            <div key={type} style={{ position: 'relative' }}>
              <RequestCard
                requestType={type}
                remaining={entry.remaining}
                onClick={() => handlePlayRequest(type)}
                disabled={!canPlay && !highlighted}
                highlighted={highlighted}
              />
              {numAttachments > 0 && (
                <div style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: 'var(--effect)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  zIndex: 10,
                }}>
                  {numAttachments}
                </div>
              )}
            </div>
          );
        })}

        {effectTypes.map(type => {
          const entry = state.clientDeck.find(e => e.type === type);
          if (!entry || entry.remaining <= 0) return null;

          const canPlayEffect = canPlay && (() => {
            if (type === 'stampeding-herd') return state.turnState.cardsPlayedThisTurn === 0;
            // Attachment effects: always playable if you have them (they just select)
            if (type === 'race-condition') return true;
            if (type === 'payment-error') return true;
            return true;
          })();

          return (
            <RequestCard
              key={type}
              requestType={type}
              remaining={entry.remaining}
              onClick={() => handlePlayEffect(type)}
              disabled={!canPlayEffect}
              selected={selectedEffect === type}
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
                  {req.effectAttached && (
                    <span style={{ color: 'var(--effect)', marginLeft: 2 }}>
                      {req.effectAttached === 'payment-error' ? '!' : req.effectAttached === 'race-condition' ? 'R' : ''}
                    </span>
                  )}
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
