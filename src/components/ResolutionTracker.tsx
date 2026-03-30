import type { RoutingContext } from '../types';

interface ResolutionTrackerProps {
  routingContext: RoutingContext;
}

const stateIcons: Record<string, string> = {
  success: '\u2713',
  failed: '\u2717',
  pending: '\u25CB',
};

export function ResolutionTracker({ routingContext }: ResolutionTrackerProps) {
  const isTerminal = routingContext.state === 'COMPLETED' || routingContext.state === 'FAILED' || routingContext.state === 'WAITING_AT_LB';
  const isSuccess = routingContext.state === 'COMPLETED';
  const isFailed = routingContext.state === 'FAILED';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-sm)',
      height: '100%',
    }}>
      <div style={{
        fontFamily: "'Satoshi', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '1.5px',
      }}>
        Resolving Request
      </div>

      {/* Step list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: 1,
        overflowY: 'auto' as const,
      }}>
        {routingContext.steps.map((step, i) => {
          const isCurrentStep = i === routingContext.steps.length - 1 && !isTerminal;
          const icon = step.result ? stateIcons[step.result] : stateIcons.pending;

          let bgColor = 'transparent';
          let textColor = 'var(--text-muted)';
          let borderColor = 'transparent';

          if (step.result === 'success') {
            bgColor = 'rgba(39, 174, 96, 0.1)';
            textColor = 'var(--success)';
          } else if (step.result === 'failed') {
            bgColor = 'rgba(231, 76, 60, 0.1)';
            textColor = 'var(--danger)';
          } else if (isCurrentStep) {
            bgColor = 'rgba(74, 158, 206, 0.12)';
            textColor = 'var(--info)';
            borderColor = 'rgba(74, 158, 206, 0.3)';
          }

          return (
            <div key={i} style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: bgColor,
              color: textColor,
              border: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ width: 16, textAlign: 'center' as const, fontSize: 13 }}>
                {icon}
              </span>
              <span>{step.description}</span>
            </div>
          );
        })}
      </div>

      {/* Toast message */}
      {routingContext.nudgeMessage && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center' as const,
          background: isFailed
            ? 'rgba(231, 76, 60, 0.12)'
            : isSuccess
              ? 'rgba(39, 174, 96, 0.12)'
              : 'rgba(74, 158, 206, 0.12)',
          border: `1px solid ${
            isFailed
              ? 'rgba(231, 76, 60, 0.3)'
              : isSuccess
                ? 'rgba(39, 174, 96, 0.3)'
                : 'rgba(74, 158, 206, 0.3)'
          }`,
          color: isFailed
            ? 'var(--danger)'
            : isSuccess
              ? 'var(--success)'
              : 'var(--info)',
        }}>
          {routingContext.nudgeMessage}
        </div>
      )}

      {/* Instruction toast when waiting for player input */}
      {routingContext.state === 'AT_LB' && !routingContext.nudgeMessage && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center' as const,
          background: 'rgba(74, 158, 206, 0.12)',
          border: '1px solid rgba(74, 158, 206, 0.3)',
          color: 'var(--info)',
        }}>
          Click a highlighted compute node to route this request.
        </div>
      )}

      {/* Service card routing hint */}
      {routingContext.state === 'AT_SERVICE' && !routingContext.nudgeMessage && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center' as const,
          background: 'rgba(212, 168, 52, 0.12)',
          border: '1px solid rgba(212, 168, 52, 0.3)',
          color: 'var(--application)',
        }}>
          Click the Payment Service to process the purchase.
        </div>
      )}

      {isTerminal && routingContext.state !== 'WAITING_AT_LB' && (
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: 'var(--text-muted)',
          textAlign: 'center' as const,
          padding: '4px',
        }}>
          Click anywhere to continue
        </div>
      )}
    </div>
  );
}
