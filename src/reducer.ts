import type { GameState, BuildStep, RequestType, EffectType } from './types';
import { createInitialGameState, makeBuildChoice, assignAppToCompute, finalizeBuild } from './engine/build';
import { createRoutingContext, routeToCompute, advanceRouting } from './engine/routing';
import { playEffect } from './engine/effects';
import { endClientTurn, endServerTurn, startTurn, addCardFromReserve, removeCard, moveAppToCompute } from './engine/turns';

export type GameAction =
  | { type: 'BUILD_CHOICE'; step: BuildStep; value: string | boolean }
  | { type: 'ASSIGN_APPS'; assignments: Record<string, string> }
  | { type: 'FINALIZE_BUILD' }
  | { type: 'PLAY_REQUEST'; requestType: RequestType }
  | { type: 'PLAY_EFFECT'; effectType: EffectType; targets?: string[] }
  | { type: 'ROUTE_TO_COMPUTE'; computeInstanceId: string }
  | { type: 'ADVANCE_ROUTING' }
  | { type: 'START_TURN' }
  | { type: 'END_CLIENT_TURN' }
  | { type: 'END_SERVER_TURN' }
  | { type: 'ADD_FROM_RESERVE'; cardId: string }
  | { type: 'REMOVE_CARD'; instanceId: string }
  | { type: 'MOVE_APP'; appInstanceId: string; targetComputeInstanceId: string }
  | { type: 'RESTART' };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'BUILD_CHOICE':
      return makeBuildChoice(state, action.step, action.value);

    case 'ASSIGN_APPS':
      return assignAppToCompute(state, action.assignments);

    case 'FINALIZE_BUILD':
      return finalizeBuild(state);

    case 'PLAY_REQUEST':
      return createRoutingContext(state, action.requestType);

    case 'PLAY_EFFECT':
      return playEffect(state, action.effectType, action.targets);

    case 'ROUTE_TO_COMPUTE':
      return routeToCompute(state, action.computeInstanceId);

    case 'ADVANCE_ROUTING':
      return advanceRouting(state);

    case 'START_TURN':
      return startTurn(state);

    case 'END_CLIENT_TURN':
      return endClientTurn(state);

    case 'END_SERVER_TURN':
      return endServerTurn(state);

    case 'ADD_FROM_RESERVE':
      return addCardFromReserve(state, action.cardId);

    case 'REMOVE_CARD':
      return removeCard(state, action.instanceId);

    case 'MOVE_APP':
      return moveAppToCompute(state, action.appInstanceId, action.targetComputeInstanceId);

    case 'RESTART':
      return createInitialGameState();

    default:
      return state;
  }
}
