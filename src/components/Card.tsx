import type { CardDefinition } from '../types';
import { getCardDef } from '../cards';

interface CardProps {
  cardId: string;
  size?: 'full' | 'arch';
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  overloaded?: boolean;
  highlighted?: boolean;
  active?: boolean;
  highlightLabel?: string;
  recommended?: boolean;
  stats?: string;
  badge?: string;
  requestCount?: number;
}

export function Card({ cardId, size = 'full', onClick, selected, disabled, overloaded, highlighted, active, highlightLabel, recommended, stats, badge, requestCount }: CardProps) {
  const def = getCardDef(cardId);
  const className = [
    'game-card',
    def.type,
    `card-${size}`,
    selected && 'selected',
    disabled && 'disabled',
    overloaded && 'overloaded',
    highlighted && 'highlighted',
    active && 'active-request',
    recommended && 'recommended',
  ].filter(Boolean).join(' ');

  const displayStats = stats || getDefaultStats(def, requestCount);

  return (
    <div className={className} onClick={onClick} style={{ position: 'relative' }}>
      <span className="card-type-label">{def.type}</span>
      <span className="card-name">{def.name}</span>
      {badge && <span className="card-capacity">{badge}</span>}
      <span className="card-stats">{displayStats}</span>
      {highlighted && highlightLabel && (
        <span style={{
          position: 'absolute',
          bottom: -16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          color: 'var(--info)',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}>
          {highlightLabel}
        </span>
      )}
      {active && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--danger)',
          animation: 'pulse 1.5s infinite',
        }} />
      )}
    </div>
  );
}

function getDefaultStats(def: CardDefinition, requestCount?: number): string {
  const parts: string[] = [];
  if (def.capacity !== undefined) {
    const count = requestCount ?? 0;
    parts.push(`${count}/${def.capacity} req`);
  }
  if (def.throughputPerTurn) parts.push(`${def.throughputPerTurn}/turn`);
  if (def.readsPerTurn) parts.push(`${def.readsPerTurn}r/${def.writesPerTurn}w per turn`);
  if (def.appSlots) parts.push(`${def.appSlots} app slot${def.appSlots > 1 ? 's' : ''}`);
  if (def.cost > 0) parts.push(`cost: -${def.cost}`);
  if (def.cost === 0 && def.type === 'application') parts.push('free');
  return parts.join('\n');
}

interface RequestCardProps {
  requestType: string;
  remaining: number;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  selected?: boolean;
}

export function RequestCard({ requestType, remaining, onClick, disabled, highlighted, selected }: RequestCardProps) {
  const isEffect = ['stampeding-herd', 'race-condition', 'payment-error'].includes(requestType);
  const cardClass = isEffect ? 'effect' : 'request';
  const names: Record<string, string> = {
    'view-event': 'View Event',
    'hold-ticket': 'Hold Ticket',
    'purchase-ticket': 'Purchase Ticket',
    'stampeding-herd': 'Stampeding Herd',
    'race-condition': 'Race Condition',
    'payment-error': 'Payment Error',
  };
  const points: Record<string, string> = {
    'view-event': '0 pts',
    'hold-ticket': '+1 pt',
    'purchase-ticket': '+5 pts',
    'stampeding-herd': '+10 cards this turn\nMust play first',
    'race-condition': 'Attach to 2 Hold Tickets\nbefore playing them',
    'payment-error': 'Attach to 1 Purchase\nTicket: earns 0 pts',
  };

  const classes = [
    'game-card', cardClass, 'card-full',
    disabled && 'disabled',
    highlighted && 'highlighted',
    selected && 'selected',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={(disabled && !highlighted) ? undefined : onClick}
    >
      <span className="card-type-label">{isEffect ? 'effect' : 'request'}</span>
      <span className="card-name">{names[requestType] || requestType}</span>
      <span className="card-capacity">{remaining}x</span>
      <span className="card-stats">{points[requestType] || ''}</span>
    </div>
  );
}
