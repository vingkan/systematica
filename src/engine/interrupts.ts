import type { GameState } from '../types';
import { ENERGY_COST_INTERRUPT } from '../types';
import { getCardDef } from '../cards';
import { getNetworkCard } from './build';

function executeInterrupt(
  state: GameState,
  interruptFn: (s: GameState) => GameState,
): GameState {
  if (state.routingContext?.state !== 'AWAITING_SERVER_REACTION') return state;
  if (state.turnState.serverEnergy < ENERGY_COST_INTERRUPT) return state;

  const newState = interruptFn(state);
  if (newState === state) return state; // interrupt fn rejected

  return {
    ...newState,
    turnState: {
      ...newState.turnState,
      serverEnergy: newState.turnState.serverEnergy - ENERGY_COST_INTERRUPT,
    },
  };
}

export function hotSwap(
  state: GameState,
  appInstanceId: string,
  targetComputeInstanceId: string,
): GameState {
  return executeInterrupt(state, (s) => {
    const appCard = s.board.find(c => c.instanceId === appInstanceId);
    if (!appCard) return s;
    const appDef = getCardDef(appCard.cardId);
    if (appDef.type !== 'application') return s;

    const targetCompute = s.board.find(c => c.instanceId === targetComputeInstanceId);
    if (!targetCompute) return s;
    const targetDef = getCardDef(targetCompute.cardId);
    if (targetDef.type !== 'compute') return s;

    // Check app slot capacity
    const currentApps = targetCompute.connections.filter(connId => {
      const c = s.board.find(b => b.instanceId === connId);
      return c && getCardDef(c.cardId).type === 'application';
    });
    if (targetDef.appSlots && currentApps.length >= targetDef.appSlots) return s;

    // Move app: remove from all compute, add to target
    const newBoard = s.board.map(c => {
      const def = getCardDef(c.cardId);
      if (def.type === 'compute') {
        const filtered = c.connections.filter(conn => conn !== appInstanceId);
        if (c.instanceId === targetComputeInstanceId) {
          return { ...c, connections: [...filtered, appInstanceId] };
        }
        return { ...c, connections: filtered };
      }
      return c;
    });

    return { ...s, board: newBoard };
  });
}

export function autoScale(state: GameState): GameState {
  return executeInterrupt(state, (s) => {
    const reserveIdx = s.reserve.indexOf('cloud-function');
    if (reserveIdx === -1) return s; // No cloud function in reserve

    const newReserve = [...s.reserve];
    newReserve.splice(reserveIdx, 1);

    const instanceId = `cf-ephemeral-${s.currentTurn}-${Date.now()}`;
    const ephemeralCard = {
      instanceId,
      cardId: 'cloud-function',
      connections: [] as string[],
      ephemeral: true,
    };

    const newBoard = [...s.board, ephemeralCard];

    // Connect LB to ephemeral card
    const lb = getNetworkCard(newBoard);
    if (lb) {
      const updatedBoard = newBoard.map(c =>
        c.instanceId === lb.instanceId
          ? { ...c, connections: [...c.connections, instanceId] }
          : c,
      );
      return { ...s, board: updatedBoard, reserve: newReserve };
    }

    return { ...s, board: newBoard, reserve: newReserve };
  });
}

export function rateLimit(
  state: GameState,
  computeInstanceId: string,
): GameState {
  return executeInterrupt(state, (s) => {
    const computeCard = s.board.find(c => c.instanceId === computeInstanceId);
    if (!computeCard) return s;
    const def = getCardDef(computeCard.cardId);
    if (def.type !== 'compute') return s;
    if (def.capacity == null) return s;

    const halved = Math.floor(def.capacity / 2);
    const newBoard = s.board.map(c =>
      c.instanceId === computeInstanceId
        ? { ...c, capacityModifier: halved }
        : c,
    );

    return { ...s, board: newBoard };
  });
}

export function circuitBreaker(
  state: GameState,
  computeInstanceId: string,
): GameState {
  return executeInterrupt(state, (s) => {
    const computeCard = s.board.find(c => c.instanceId === computeInstanceId);
    if (!computeCard) return s;
    const def = getCardDef(computeCard.cardId);
    if (def.type !== 'compute') return s;

    // Disable the node
    const newBoard = s.board.map(c =>
      c.instanceId === computeInstanceId
        ? { ...c, disabledUntilTurn: s.currentTurn + 1 }
        : c,
    );

    // Bounce all active requests on this node to lb-queue
    const requests = s.requests.map(r => {
      if (r.status === 'active' && r.location === computeInstanceId) {
        return { ...r, location: 'lb-queue', waitingSince: s.currentTurn };
      }
      return r;
    });

    return { ...s, board: newBoard, requests };
  });
}
