import { useState, useRef, useEffect, useCallback } from 'react';
import type { GameState, PlacedCard } from '../engine/types';
import type { GameAction } from '../reducer';
import { getCardDef } from '../engine/cards';
import { Card } from './Card';

interface ServerBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  flashCardId?: string | null;
  routingPath?: string[];
  nextTargetCardId?: string | null;
  onServerCardClick?: (instanceId: string) => void;
}

interface Line {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  sourceId?: string;
  targetId?: string;
  bendFraction?: number; // 0-1, where in the vertical gap to place the horizontal bend
}

function computeLines(containerEl: HTMLElement, board: PlacedCard[]): Line[] {
  const rect = containerEl.getBoundingClientRect();
  const lines: Line[] = [];

  // Network -> Compute lines
  for (const card of board) {
    const def = getCardDef(card.cardId);
    if (def.type !== 'network') continue;

    const networkEl = containerEl.querySelector(`[data-instance-id="${card.instanceId}"]`);
    if (!networkEl) continue;
    const networkRect = networkEl.getBoundingClientRect();
    const networkMidX = networkRect.left + networkRect.width / 2 - rect.left;
    const networkBottom = networkRect.bottom - rect.top;

    for (const connId of card.connections) {
      const connCard = board.find(c => c.instanceId === connId);
      if (!connCard) continue;
      const connDef = getCardDef(connCard.cardId);
      if (connDef.type !== 'compute') continue;

      const connEl = containerEl.querySelector(`[data-instance-id="${connId}"]`);
      if (!connEl) continue;
      const connRect = connEl.getBoundingClientRect();
      const connMidX = connRect.left + connRect.width / 2 - rect.left;
      const connTop = connRect.top - rect.top;

      lines.push({
        x1: networkMidX, y1: networkBottom,
        x2: connMidX, y2: connTop,
        color: 'var(--network)',
        sourceId: card.instanceId,
        targetId: connId,
      });
    }
  }

  // Application -> Compute/Storage lines
  const appToStorageLines: Line[] = [];

  for (const card of board) {
    const def = getCardDef(card.cardId);
    if (def.type !== 'application') continue;

    const appEl = containerEl.querySelector(`[data-instance-id="${card.instanceId}"]`);
    if (!appEl) continue;
    const appRect = appEl.getBoundingClientRect();
    const appMidX = appRect.left + appRect.width / 2 - rect.left;
    const appTop = appRect.top - rect.top;
    const appBottom = appRect.bottom - rect.top;

    for (const connId of card.connections) {
      const connCard = board.find(c => c.instanceId === connId);
      if (!connCard) continue;
      const connDef = getCardDef(connCard.cardId);
      const connEl = containerEl.querySelector(`[data-instance-id="${connId}"]`);
      if (!connEl) continue;
      const connRect = connEl.getBoundingClientRect();
      const connMidX = connRect.left + connRect.width / 2 - rect.left;

      if (connDef.type === 'compute') {
        const connBottom = connRect.bottom - rect.top;
        lines.push({
          x1: connMidX, y1: connBottom,
          x2: appMidX, y2: appTop,
          color: 'var(--application)',
          sourceId: connId,
          targetId: card.instanceId,
        });
      } else if (connDef.type === 'storage') {
        const connTop = connRect.top - rect.top;
        appToStorageLines.push({
          x1: appMidX, y1: appBottom,
          x2: connMidX, y2: connTop,
          color: 'var(--storage)',
          sourceId: card.instanceId,
          targetId: connId,
        });
      }
    }
  }

  // Stagger app-to-storage lines: sort by source X (leftmost first), assign evenly spaced fractions
  appToStorageLines.sort((a, b) => a.x1 - b.x1);
  const count = appToStorageLines.length;
  for (let i = 0; i < count; i++) {
    appToStorageLines[i].bendFraction = (i + 1) / (count + 1);
  }
  lines.push(...appToStorageLines);

  return lines;
}

function renderPath(line: Line): string {
  const fraction = line.bendFraction ?? 0.5;
  const midY = line.y1 + (line.y2 - line.y1) * fraction;
  return `M ${line.x1} ${line.y1} L ${line.x1} ${midY} L ${line.x2} ${midY} L ${line.x2} ${line.y2}`;
}

export function ServerBoard({ state, dispatch, flashCardId, routingPath = [], nextTargetCardId, onServerCardClick }: ServerBoardProps) {
  const [connectingApp, setConnectingApp] = useState<{ cardId: string; computeId?: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const isServerTurn = state.phase === 'server-turn';

  const networkCards = state.board.filter(c => getCardDef(c.cardId).type === 'network');
  const computeCards = state.board.filter(c => getCardDef(c.cardId).type === 'compute');
  const appCards = state.board.filter(c => getCardDef(c.cardId).type === 'application');
  const storageCards = state.board.filter(c => getCardDef(c.cardId).type === 'storage');

  const deckCounts: Record<string, number> = {};
  for (const id of state.serverDeck) {
    deckCounts[id] = (deckCounts[id] ?? 0) + 1;
  }

  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    setLines(computeLines(containerRef.current, state.board));
  }, [state.board]);

  useEffect(() => {
    updateLines();
    const observer = new ResizeObserver(updateLines);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateLines]);

  // Update lines after DOM paints (cards may have moved)
  useEffect(() => {
    requestAnimationFrame(updateLines);
  }, [state.board, updateLines]);

  const handlePlayCard = (cardId: string) => {
    const def = getCardDef(cardId);
    if (def.type === 'application') {
      setConnectingApp({ cardId });
    } else {
      dispatch({ type: 'PLAY_CARD', cardId });
    }
  };

  const handleCardClick = (instanceId: string, type: string) => {
    if (!connectingApp) return;
    if (type === 'compute' && !connectingApp.computeId) {
      setConnectingApp({ ...connectingApp, computeId: instanceId });
    } else if (type === 'storage' && connectingApp.computeId) {
      dispatch({
        type: 'PLAY_APP_CARD',
        cardId: connectingApp.cardId,
        computeInstanceId: connectingApp.computeId,
        storageInstanceId: instanceId,
      });
      setConnectingApp(null);
    }
  };

  const layers = [
    { name: 'Network', cards: networkCards, type: 'network' },
    { name: 'Compute', cards: computeCards, type: 'compute' },
    { name: 'Application', cards: appCards, type: 'application' },
    { name: 'Storage', cards: storageCards, type: 'storage' },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* SVG overlay for connection lines */}
      <svg style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        {lines.map((line, i) => {
          const isOnPath = routingPath.length > 0 && line.sourceId && line.targetId
            && routingPath.includes(line.sourceId) && routingPath.includes(line.targetId);
          return (
            <path
              key={i}
              d={renderPath(line)}
              fill="none"
              stroke={isOnPath ? 'var(--info)' : line.color}
              strokeWidth={isOnPath ? 2.5 : 1.5}
              strokeDasharray={isOnPath ? '6 6' : '4 3'}
              opacity={isOnPath ? 0.9 : 0.4}
              className={isOnPath ? 'routing-path-active' : undefined}
            />
          );
        })}
      </svg>

      <span className="side-label">Server Board</span>

      {layers.map((layer, layerIdx) => {
        const isHighlightTarget = connectingApp && (
          (layer.type === 'compute' && !connectingApp.computeId) ||
          (layer.type === 'storage' && !!connectingApp.computeId)
        );

        // Hide default connector when both adjacent layers have cards (SVG lines take over)
        const prevLayer = layerIdx > 0 ? layers[layerIdx - 1] : null;
        const showDefaultConnector = layerIdx > 0 && !(prevLayer!.cards.length > 0 && layer.cards.length > 0);

        return (
          <div key={layer.name}>
            {layerIdx > 0 && showDefaultConnector && (
              <div className="arch-connector">
                <div className="arch-connector-line" />
              </div>
            )}
            {layerIdx > 0 && !showDefaultConnector && (
              <div className="arch-connector" />
            )}
            <div className="arch-layer">
              {layer.cards.length === 0 ? (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}>
                  No {layer.name.toLowerCase()} cards
                </span>
              ) : (
                layer.cards.map(card => {
                  const isFlashing = flashCardId === card.instanceId;
                  const isOnPath = routingPath.includes(card.instanceId);
                  const isNextTarget = nextTargetCardId === card.instanceId;
                  return (
                    <div
                      key={card.instanceId}
                      data-instance-id={card.instanceId}
                      className={isFlashing ? 'flash' : ''}
                      style={{ position: 'relative', zIndex: 2 }}
                    >
                      <Card
                        cardId={card.cardId}
                        size="arch"
                        currentLoad={card.currentLoad}
                        highlighted={!!isHighlightTarget || isOnPath || isNextTarget}
                        recommended={isNextTarget}
                        highlightLabel={
                          isNextTarget ? 'click to resolve'
                          : isHighlightTarget
                            ? (!connectingApp!.computeId ? 'click to connect' : 'click to connect')
                            : undefined
                        }
                        overloaded={card.currentLoad > 0 && card.currentLoad >= (getCardDef(card.cardId).capacity ?? Infinity)}
                        onClick={() => {
                          if (isNextTarget && onServerCardClick) {
                            onServerCardClick(card.instanceId);
                          } else if (isHighlightTarget) {
                            handleCardClick(card.instanceId, layer.type);
                          } else if (isServerTurn) {
                            dispatch({ type: 'REMOVE_CARD', instanceId: card.instanceId });
                          }
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* Deck - segmented by type with stable positions */}
      {isServerTurn && (
        <div className="played-area">
          <div className="played-label">
            Deck ({state.serverDeck.length} cards)
            {connectingApp && (
              <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                Connecting {getCardDef(connectingApp.cardId).name}...
                {!connectingApp.computeId ? ' Pick compute' : ' Pick storage'}
              </span>
            )}
          </div>
          {[
            { label: 'Network', color: 'var(--network)', cards: ['round-robin-lb', 'least-connections-lb'] },
            { label: 'Compute', color: 'var(--compute)', cards: ['container', 'cloud-function'] },
            { label: 'Storage', color: 'var(--storage)', cards: ['relational-db', 'kv-store'] },
            { label: 'Application', color: 'var(--application)', cards: ['read-event', 'write-hold', 'write-payment'] },
          ].map(section => (
            <div key={section.label} style={{ marginBottom: 8 }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: section.color,
                marginBottom: 4,
                opacity: 0.7,
              }}>
                {section.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {section.cards.map(cardId => {
                  const count = deckCounts[cardId] ?? 0;
                  return (
                    <div
                      key={cardId}
                      onClick={count > 0 ? () => handlePlayCard(cardId) : undefined}
                      style={{ position: 'relative', opacity: count > 0 ? 1 : 0.25, pointerEvents: count > 0 ? 'auto' : 'none' }}
                    >
                      <Card cardId={cardId} size="arch" badge={`${count}x`} disabled={count === 0} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {connectingApp && (
            <button className="btn" onClick={() => setConnectingApp(null)} style={{ marginTop: 8 }}>
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="queue-bar">
        <span><span className="queue-dot done" /> Board: {state.board.length} cards</span>
        <span><span className="queue-dot active" /> Deck: {state.serverDeck.length} remaining</span>
      </div>
    </div>
  );
}
