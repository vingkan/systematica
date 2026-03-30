import type { CardDefinition } from '../engine/types';
import { getCardDef } from '../engine/cards';

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
  currentLoad?: number;
}

export function Card({ cardId, size = 'full', onClick, selected, disabled, overloaded, highlighted, active, highlightLabel, recommended, stats, badge, currentLoad }: CardProps) {
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

  const displayStats = stats || getDefaultStats(def, currentLoad);

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

function getDefaultStats(def: CardDefinition, currentLoad?: number): string {
  const parts: string[] = [];
  if (def.capacity !== undefined) {
    const load = currentLoad ?? 0;
    parts.push(`${load}/${def.capacity} req`);
  }
  if (def.costPerTurn) parts.push(`cost: ${def.costPerTurn}/turn`);
  if (def.costPerRequest) parts.push(`cost: ${def.costPerRequest}/req`);
  if (def.appSlots) parts.push(`${def.appSlots} app slot${def.appSlots > 1 ? 's' : ''}`);
  if (def.durable === true) parts.push('durable');
  if (def.durable === false) parts.push('not durable');
  if (def.costReduction) parts.push(`-${def.costReduction} cost/req`);
  if (def.storageOp) parts.push(`${def.storageOp} op`);
  return parts.join('\n');
}

interface RequestCardProps {
  cardId: string;
  remaining: number;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  selected?: boolean;
}

const CLIENT_CARD_NAMES: Record<string, string> = {
  'view-event': 'View Event',
  'hold-ticket': 'Hold Ticket',
  'purchase-ticket': 'Purchase Ticket',
  'stampeding-herd': 'Stampeding Herd',
  'race-condition': 'Race Condition',
  'server-error': 'Server Error',
};

const CLIENT_CARD_DESCS: Record<string, string> = {
  'view-event': 'vol: 10 | 1 pt/req\nneeds: Read Event',
  'hold-ticket': 'vol: 4 | 1 pt/req\nneeds: Write Hold',
  'purchase-ticket': 'vol: 4 | 1 pt/req\nneeds: Write Payment',
  'stampeding-herd': 'Doubles volume\nAttach to any request',
  'race-condition': 'Halves value if\nstorage not durable',
  'server-error': 'Reduces value to 0\nAttach to any request',
};

export function RequestCard({ cardId, remaining, onClick, disabled, highlighted, selected }: RequestCardProps) {
  const isEffect = ['stampeding-herd', 'race-condition', 'server-error'].includes(cardId);
  const cardClass = isEffect ? 'effect' : 'request';

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
      <span className="card-name">{CLIENT_CARD_NAMES[cardId] || cardId}</span>
      <span className="card-capacity">{remaining}x</span>
      <span className="card-stats">{CLIENT_CARD_DESCS[cardId] || ''}</span>
    </div>
  );
}
