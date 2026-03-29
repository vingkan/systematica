import { useState } from 'react';
import type { GameState } from '../types';
import { getCardDef } from '../cards';
import { Card } from './Card';
import type { GameAction } from '../reducer';
import { addLog } from './GameLog';

interface ServerArchitectureProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ServerArchitecture({ state, dispatch }: ServerArchitectureProps) {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const networkCards = state.board.filter(c => getCardDef(c.cardId).type === 'network');
  const computeCards = state.board.filter(c => getCardDef(c.cardId).type === 'compute');
  const storageCards = state.board.filter(c => getCardDef(c.cardId).type === 'storage');
  const appCards = state.board.filter(c => getCardDef(c.cardId).type === 'application');

  const requestsOnCard = (instanceId: string) =>
    state.requests.filter(r => r.location === instanceId && r.status === 'active').length;

  const queuedAtLB = state.requests.filter(r => r.location === 'lb-queue' && r.status === 'active').length;

  const isServerTurn = state.activePlayer === 'server' && state.phase === 'play';
  const isRouting = state.routingContext != null;
  const routingCtx = state.routingContext;

  const getAppsOnCompute = (computeInstanceId: string) => {
    const compute = state.board.find(c => c.instanceId === computeInstanceId);
    if (!compute) return [];
    return compute.connections
      .map(connId => state.board.find(c => c.instanceId === connId))
      .filter(c => c && getCardDef(c.cardId).type === 'application')
      .map(c => c!);
  };

  // All assigned app instance IDs
  const assignedAppIds = new Set(
    computeCards.flatMap(c => c.connections.filter(connId => {
      const card = state.board.find(b => b.instanceId === connId);
      return card && getCardDef(card.cardId).type === 'application';
    }))
  );
  const unassignedApps = appCards.filter(a => !assignedAppIds.has(a.instanceId));

  const handleAppClick = (appInstanceId: string) => {
    if (!isServerTurn) return;
    setSelectedApp(prev => prev === appInstanceId ? null : appInstanceId);
  };

  const handleComputeClick = (computeInstanceId: string) => {
    // Routing mode: route request to this compute node
    if (isRouting && routingCtx?.state === 'AT_LB') {
      dispatch({ type: 'ROUTE_TO_COMPUTE', computeInstanceId });
      return;
    }
    // App movement mode
    if (selectedApp && isServerTurn) {
      dispatch({ type: 'MOVE_APP', appInstanceId: selectedApp, targetComputeInstanceId: computeInstanceId });
      const appCard = state.board.find(c => c.instanceId === selectedApp);
      const computeCard = state.board.find(c => c.instanceId === computeInstanceId);
      if (appCard && computeCard) {
        addLog(`Moved ${getCardDef(appCard.cardId).name} → ${getCardDef(computeCard.cardId).name}`, 'info');
      }
      setSelectedApp(null);
    }
  };

  const handleRemoveCard = (instanceId: string) => {
    if (!isServerTurn || state.turnState.serverActionsUsed >= 1) return;
    const card = state.board.find(c => c.instanceId === instanceId);
    if (card) {
      dispatch({ type: 'REMOVE_CARD', instanceId });
      addLog(`Removed ${getCardDef(card.cardId).name}`, 'warning');
    }
  };

  const handleAddFromReserve = (cardId: string) => {
    dispatch({ type: 'ADD_FROM_RESERVE', cardId });
    addLog(`Added ${getCardDef(cardId).name} from reserve`, 'success');
  };

  const shortAppName = (cardId: string) => {
    return getCardDef(cardId).name
      .replace('Write Ticket Hold', 'W:Hold')
      .replace('Write Purchase', 'W:Purchase')
      .replace('Read Event', 'R:Event')
      .replace('Payment Service', 'Payment');
  };

  return (
    <div className="server-side">
      <div className="side-label">server architecture</div>

      {/* Network layer */}
      <div className="arch-layer">
        {networkCards.map(c => {
          const def = getCardDef(c.cardId);
          const isLBActive = routingCtx?.state === 'AT_LB' || routingCtx?.state === 'WAITING_AT_LB';
          return (
            <Card
              key={c.instanceId}
              cardId={c.cardId}
              size="arch"
              active={isLBActive}
              badge={`${state.turnState.lbThroughputUsed}/${def.throughputPerTurn}`}
              stats={`${def.lbAlgorithm} | ${queuedAtLB} queued`}
            />
          );
        })}
      </div>

      <Connector count={computeCards.length} />

      {/* Compute layer: each compute card with its apps inline */}
      <div className="arch-layer" style={{ gap: 'var(--sp-md)' }}>
        {computeCards.map(c => {
          const def = getCardDef(c.cardId);
          const load = requestsOnCard(c.instanceId);
          const isOverloaded = def.capacity !== undefined && load >= def.capacity;
          const apps = getAppsOnCompute(c.instanceId);
          const isValidTarget = routingCtx?.validTargets.includes(c.instanceId) ?? false;
          const isRecommended = routingCtx?.lbRecommendation === c.instanceId;
          const hasActiveRequest = routingCtx?.computeNodeId === c.instanceId;
          const isClickable = isValidTarget || selectedApp != null;

          return (
            <div
              key={c.instanceId}
              className={`compute-group ${selectedApp ? 'drop-target' : ''}`}
              onClick={() => isClickable ? handleComputeClick(c.instanceId) : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 8,
                borderRadius: 'var(--radius-lg)',
                border: selectedApp ? '1px dashed var(--application)' : '1px solid transparent',
                cursor: selectedApp ? 'pointer' : 'default',
                transition: 'border-color var(--dur-short) var(--ease-out)',
              }}
            >
              <Card
                cardId={c.cardId}
                size="arch"
                overloaded={isOverloaded}
                highlighted={isValidTarget}
                recommended={isRecommended}
                active={hasActiveRequest}
                highlightLabel={isValidTarget ? (isRecommended ? 'LB recommends' : 'click to route') : undefined}
                badge={`${load}/${def.capacity}`}
                stats={`${def.appSlots} slots | ${load} active`}
                onClick={() => isClickable ? handleComputeClick(c.instanceId) : undefined}
              />
              {/* Apps as compact row */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {apps.map(app => (
                  <AppChip
                    key={app.instanceId}
                    name={shortAppName(app.cardId)}
                    selected={selectedApp === app.instanceId}
                    onClick={() => handleAppClick(app.instanceId)}
                    clickable={isServerTurn}
                  />
                ))}
                {apps.length === 0 && (
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    empty
                  </span>
                )}
              </div>
              {/* Remove button */}
              {isServerTurn && state.turnState.serverActionsUsed < 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveCard(c.instanceId); }}
                  style={{
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* App assignment hint */}
      {selectedApp && (
        <div style={{
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--application)',
          padding: 4,
        }}>
          click a compute group to move the app there
        </div>
      )}

      <Connector count={storageCards.length} />

      {/* Storage layer */}
      <div className="arch-layer">
        {storageCards.map(c => {
          const def = getCardDef(c.cardId);
          const ops = state.turnState.storageOps[c.instanceId] || { reads: 0, writes: 0 };
          return (
            <Card
              key={c.instanceId}
              cardId={c.cardId}
              size="arch"
              stats={`r: ${ops.reads}/${def.readsPerTurn}  w: ${ops.writes}/${def.writesPerTurn}`}
            />
          );
        })}
      </div>

      {/* Unassigned apps */}
      {unassignedApps.length > 0 && (
        <div style={{ marginTop: 'var(--sp-sm)', padding: '6px 8px', background: 'rgba(212,168,52,0.05)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--application-border)' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--warning)', letterSpacing: 1, textTransform: 'uppercase' }}>
            unassigned
          </span>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
            {unassignedApps.map(app => (
              <AppChip
                key={app.instanceId}
                name={shortAppName(app.cardId)}
                selected={selectedApp === app.instanceId}
                onClick={() => handleAppClick(app.instanceId)}
                clickable={isServerTurn}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reserve pool */}
      {isServerTurn && state.reserve.length > 0 && state.turnState.serverActionsUsed < 1 && (
        <div style={{ marginTop: 'var(--sp-sm)', paddingTop: 'var(--sp-sm)', borderTop: '1px dashed var(--grid-line-major)' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
            reserve
          </span>
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap', marginTop: 4 }}>
            {[...new Set(state.reserve)].map(cardId => (
              <button
                key={cardId}
                className="btn"
                style={{ fontSize: 10, padding: '4px 8px' }}
                onClick={() => handleAddFromReserve(cardId)}
              >
                + {getCardDef(cardId).name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Queue status */}
      <div className="queue-bar" style={{ marginTop: 'auto', paddingTop: 'var(--sp-sm)' }}>
        <span><span className="queue-dot done" /> {state.completedRequests.length} done</span>
        <span><span className="queue-dot active" /> {state.requests.filter(r => r.status === 'active').length} active</span>
        <span><span className="queue-dot fail" /> {state.failedRequests.length} failed</span>
      </div>
    </div>
  );
}

function AppChip({ name, selected, onClick, clickable }: {
  name: string;
  selected: boolean;
  onClick: () => void;
  clickable: boolean;
}) {
  return (
    <span
      onClick={clickable ? onClick : undefined}
      style={{
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        color: selected ? '#fff' : 'var(--application)',
        padding: '2px 5px',
        background: selected ? 'var(--application)' : 'var(--application-bg)',
        border: '1px solid var(--application-border)',
        borderRadius: 'var(--radius-sm)',
        cursor: clickable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  );
}

function Connector({ count }: { count: number }) {
  return (
    <div className="arch-connector">
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <span key={i} className="arch-connector-line" style={{ margin: '0 24px' }} />
      ))}
    </div>
  );
}
