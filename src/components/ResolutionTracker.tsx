import { useState, useEffect, useRef } from 'react';
import type { GameState, RoutingStep, ResolutionResult } from '../engine/types';
import type { GameAction } from '../reducer';
import { getClientCardDef } from '../engine/cards';

interface ResolutionTrackerProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onFlashCard: (instanceId: string) => void;
  onSetRoutingPath: (path: string[]) => void;
  onSetNextTarget: (cardId: string | null, stepFn: (() => void) | null) => void;
}

export function ResolutionTracker({ state, dispatch, onFlashCard, onSetRoutingPath, onSetNextTarget }: ResolutionTrackerProps) {
  const { faceDownCards, resolutionIndex, currentResolution, resolutionStepIndex } = state;
  const currentCard = faceDownCards[resolutionIndex];
  const [isFlipped, setIsFlipped] = useState(false);

  // Cache the last resolution so we can keep showing steps after it's cleared
  const lastResolutionRef = useRef<ResolutionResult | null>(null);
  if (currentResolution) {
    lastResolutionRef.current = currentResolution;
  }
  const displayResolution = currentResolution ?? lastResolutionRef.current;

  // Reset when moving to a new card
  useEffect(() => {
    setIsFlipped(false);
    lastResolutionRef.current = null;
    onSetRoutingPath([]);
  }, [resolutionIndex, onSetRoutingPath]);

  // Update routing path as steps are revealed
  useEffect(() => {
    if (!displayResolution) {
      onSetRoutingPath([]);
      return;
    }
    const stepsToShow = currentResolution ? resolutionStepIndex : displayResolution.steps.length;
    const pathIds: string[] = [];
    for (let i = 0; i <= stepsToShow && i < displayResolution.steps.length; i++) {
      const step = displayResolution.steps[i];
      if (step.cardInstanceId) pathIds.push(step.cardInstanceId);
    }
    onSetRoutingPath(pathIds);
  }, [currentResolution, displayResolution, resolutionStepIndex, onSetRoutingPath]);

  const handleFlip = () => {
    setIsFlipped(true);
    setTimeout(() => {
      dispatch({ type: 'FLIP_NEXT_CARD' });
    }, 500);
  };

  const handleStep = () => {
    if (!currentResolution) return;
    const nextStep = currentResolution.steps[resolutionStepIndex];
    if (nextStep?.cardInstanceId) {
      onFlashCard(nextStep.cardInstanceId);
    }
    dispatch({ type: 'STEP_RESOLUTION' });
  };

  const handleAdvance = () => {
    onSetRoutingPath([]);
    lastResolutionRef.current = null;
    dispatch({ type: 'ADVANCE_RESOLUTION' });
  };

  const nextExpectedStep: RoutingStep | null = currentResolution && resolutionStepIndex < currentResolution.steps.length
    ? currentResolution.steps[resolutionStepIndex]
    : null;

  // Set next target card for click-to-resolve
  useEffect(() => {
    if (nextExpectedStep?.cardInstanceId) {
      onSetNextTarget(nextExpectedStep.cardInstanceId, handleStep);
    } else {
      onSetNextTarget(null, null);
    }
    return () => onSetNextTarget(null, null);
  }, [nextExpectedStep?.cardInstanceId]);

  const isLastCard = resolutionIndex + 1 >= faceDownCards.length;
  const isResolved = !currentResolution && currentCard?.resolved;
  const hasSteps = displayResolution && displayResolution.steps.length > 0;

  const layerColors: Record<string, string> = {
    network: 'var(--network)',
    compute: 'var(--compute)',
    application: 'var(--application)',
    storage: 'var(--storage)',
    effect: 'var(--effect)',
  };

  // How many steps to show
  const stepsVisible = currentResolution
    ? resolutionStepIndex  // still stepping through
    : displayResolution ? displayResolution.steps.length : 0;  // all steps after resolved

  return (
    <>
      <span className="side-label">
        Resolution ({resolutionIndex + 1}/{faceDownCards.length})
      </span>

      {/* Flip card area */}
      {currentCard && !displayResolution && !currentCard.resolved && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, flexDirection: 'column', alignItems: 'center' }}>
          <div
            className="card-flip-container"
            onClick={!isFlipped ? handleFlip : undefined}
            style={{ cursor: !isFlipped ? 'pointer' : 'default', width: 200, height: 100 }}
          >
            <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''}`} style={{ width: 200, height: 100 }}>
              <div className="card-flip-front" style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 100 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14,
                  color: 'var(--text-muted)',
                  letterSpacing: 2,
                }}>
                  ?
                </span>
              </div>
              <div className="card-flip-back" style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 100 }}>
                <div className="game-card request card-arch" style={{ width: 200, height: 100, cursor: 'default', boxSizing: 'border-box' }}>
                  <span className="card-type-label">request</span>
                  <span className="card-name">{getClientCardDef(currentCard.deckCardId).name}</span>
                  <span className="card-stats">
                    Volume: {currentCard.volume}
                    {currentCard.attachedEffects.includes('stampeding-herd') && ` x2 = ${currentCard.volume * 2}`}
                    {currentCard.attachedEffects.length > 0 && '\n'}
                    {currentCard.attachedEffects.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {!isFlipped && (
            <div style={{
              textAlign: 'center',
              marginTop: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'var(--text-muted)',
            }}>
              Click to flip
            </div>
          )}
        </div>
      )}

      {/* Card info shown during and after resolution (fixed width, centered) */}
      {hasSteps && currentCard && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div className="game-card request card-arch" style={{ width: 200, height: 100, cursor: 'default', boxSizing: 'border-box' }}>
            <span className="card-type-label">{isResolved ? 'resolved' : 'resolving'}</span>
            <span className="card-name">{getClientCardDef(currentCard.deckCardId).name}</span>
            <span className="card-stats">
              Volume: {currentCard.volume}
              {currentCard.attachedEffects.includes('stampeding-herd') && ` x2 = ${currentCard.volume * 2}`}
              {currentCard.attachedEffects.length > 0 && '\n'}
              {currentCard.attachedEffects.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Routing steps (shown during AND after resolution) */}
      {hasSteps && (
        <div style={{ marginBottom: 16, width: '100%', maxWidth: 400 }}>
          {displayResolution!.steps.map((step, i) => {
            if (i > stepsVisible) return null;
            const isNegativeEffect = step.layer === 'effect' && step.negative;
            const color = isNegativeEffect ? 'var(--danger)' : (layerColors[step.layer] ?? 'var(--text-muted)');
            const hasFailure = step.volumeStopped > 0;

            return (
              <div key={i} style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '6px 0',
                borderLeft: `2px solid ${color}`,
                paddingLeft: 12,
                marginLeft: 8,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color,
                  minWidth: 90,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {step.layer}
                </span>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: (hasFailure || isNegativeEffect) ? 'var(--danger)' : 'var(--text-primary)',
                  lineHeight: 1.4,
                }}>
                  {step.description}
                  {hasFailure && (
                    <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--danger)' }}>
                      {step.volumeStopped} requests stopped
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {/* Next expected step preview (only while stepping) */}
          {nextExpectedStep && (
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '6px 0',
              borderLeft: `2px dashed ${layerColors[nextExpectedStep.layer] ?? 'var(--text-muted)'}`,
              paddingLeft: 12,
              marginLeft: 8,
              opacity: 0.5,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: layerColors[nextExpectedStep.layer],
                minWidth: 90,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                {nextExpectedStep.layer}
              </span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}>
                Next...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Incremental score change from this request */}
      {isResolved && displayResolution && (
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          maxWidth: 400,
          width: '100%',
        }}>
          <span style={{ color: 'var(--info)' }}>
            con {displayResolution.consistencyGained >= 0 ? '+' : ''}{displayResolution.consistencyGained}
          </span>
          <span style={{ color: 'var(--success)' }}>
            avl {displayResolution.availabilityGained - displayResolution.availabilityLost >= 0 ? '+' : ''}{displayResolution.availabilityGained - displayResolution.availabilityLost}
          </span>
          <span style={{ color: 'var(--request)' }}>
            req +{displayResolution.requestsCounted}
          </span>
          <span style={{ color: 'var(--warning)' }}>
            cost {displayResolution.costIncurred > 0 ? '+' : ''}{displayResolution.costIncurred}
          </span>
        </div>
      )}

      {/* Action buttons: Next Step (left) OR Next Request (right), never both */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
      }}>
        {currentResolution && nextExpectedStep ? (
          <>
            <button className="btn" onClick={handleStep}>
              Next Step
            </button>
            <div />
          </>
        ) : isResolved ? (
          <>
            <div />
            <button className="btn primary" onClick={handleAdvance}>
              {isLastCard ? 'End Resolution' : 'Next Request'}
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
