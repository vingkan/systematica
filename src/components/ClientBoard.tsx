import { useState } from 'react';
import type { GameState } from '../engine/types';
import type { GameAction } from '../reducer';
import { getClientCardDef, isRequestCard, isEffectCard } from '../engine/cards';
import { RequestCard } from './Card';

interface ClientBoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ClientBoard({ state, dispatch }: ClientBoardProps) {
  const [attachingEffect, setAttachingEffect] = useState<string | null>(null);
  const isClientTurn = state.phase === 'client-turn';
  const cardsPerTurn = state.config.cardsPerTurn ?? 5;

  // Group deck cards by id with counts
  const deckCounts: Record<string, number> = {};
  for (const id of state.clientDeck) {
    deckCounts[id] = (deckCounts[id] ?? 0) + 1;
  }

  const handlePlayCard = (cardId: string) => {
    if (isRequestCard(cardId)) {
      dispatch({ type: 'PLACE_CARD_FACE_DOWN', cardId });
    } else if (isEffectCard(cardId)) {
      setAttachingEffect(cardId);
    }
  };

  const handleAttachToCard = (index: number) => {
    if (attachingEffect) {
      dispatch({ type: 'ATTACH_EFFECT', effectCardId: attachingEffect, faceDownIndex: index });
      setAttachingEffect(null);
    }
  };

  const handleTakeBack = (index: number) => {
    if (attachingEffect) return; // Don't take back while attaching
    dispatch({ type: 'TAKE_BACK_CARD', faceDownIndex: index });
  };

  const handleDetachEffect = (cardIndex: number, effectIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'DETACH_EFFECT', faceDownIndex: cardIndex, effectIndex });
  };

  return (
    <>
      <span className="side-label">
        Client Board
        {attachingEffect && (
          <span style={{ color: 'var(--effect)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
            Click a face-down card to attach {getClientCardDef(attachingEffect).name}
          </span>
        )}
      </span>

      {/* Face-down cards */}
      <div className="played-area" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
        <div className="played-label">
          Face-down cards ({state.faceDownCards.length}/{cardsPerTurn})
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: cardsPerTurn }).map((_, i) => {
            const card = state.faceDownCards[i];
            if (!card) {
              return (
                <div
                  key={i}
                  style={{
                    width: 120,
                    minHeight: 72,
                    border: '2px dashed var(--text-muted)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: 'var(--text-muted)',
                  }}
                >
                  Slot {i + 1}
                </div>
              );
            }

            const def = getClientCardDef(card.deckCardId);

            return (
              <div
                key={i}
                className={`game-card request card-arch ${attachingEffect ? 'highlighted' : ''}`}
                onClick={() => attachingEffect ? handleAttachToCard(i) : isClientTurn && handleTakeBack(i)}
                style={{
                  width: 120,
                  cursor: isClientTurn ? 'pointer' : 'default',
                }}
                title={isClientTurn && !attachingEffect ? 'Click to take back' : undefined}
              >
                <span className="card-type-label">request</span>
                <span className="card-name">{def.name}</span>
                <span className="card-stats">
                  vol: {card.volume}
                  {card.attachedEffects.map((e, j) => (
                    <span
                      key={j}
                      style={{
                        display: 'block',
                        color: 'var(--effect)',
                        cursor: isClientTurn ? 'pointer' : 'default',
                      }}
                      onClick={isClientTurn ? (ev) => handleDetachEffect(i, j, ev) : undefined}
                      title={isClientTurn ? 'Click to detach' : undefined}
                    >
                      {e} {isClientTurn ? '×' : ''}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client deck (hand) */}
      {isClientTurn && (
        <>
          <div className="played-area">
            <div className="played-label">Your Deck ({state.clientDeck.length} cards)</div>
          </div>
          <div className="client-hand">
            {Object.entries(deckCounts).map(([cardId, count]) => (
              <RequestCard
                key={cardId}
                cardId={cardId}
                remaining={count}
                onClick={() => handlePlayCard(cardId)}
                selected={attachingEffect === cardId}
              />
            ))}
          </div>
          {attachingEffect && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button className="btn" onClick={() => setAttachingEffect(null)}>
                Cancel attachment
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
