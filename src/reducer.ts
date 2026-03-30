import type { GameState, BuildStep, RequestType, EffectType } from './types';
import { createInitialGameState, makeBuildChoice, assignAppToCompute, finalizeBuild } from './engine/build';
import { createRoutingContext, routeToCompute, routeToStorage, routeToService, advanceRouting, serverPassReaction } from './engine/routing';
import { playStampedingherd, selectEffect, attachEffect } from './engine/effects';
import { endClientTurn, endServerTurn, startTurn, addCardFromReserve, removeCard, moveAppToCompute } from './engine/turns';
import { hotSwap, autoScale, rateLimit, circuitBreaker } from './engine/interrupts';

export type GameAction =
  | { type: 'BUILD_CHOICE'; step: BuildStep; value: string | boolean }
  | { type: 'ASSIGN_APPS'; assignments: Record<string, string> }
  | { type: 'FINALIZE_BUILD' }
  | { type: 'PLAY_REQUEST'; requestType: RequestType }
  | { type: 'PLAY_STAMPEDING_HERD' }
  | { type: 'SELECT_EFFECT'; effectType: EffectType }
  | { type: 'ATTACH_EFFECT'; requestType: RequestType }
  | { type: 'ROUTE_TO_COMPUTE'; computeInstanceId: string }
  | { type: 'ROUTE_TO_STORAGE'; storageInstanceId: string }
  | { type: 'ROUTE_TO_SERVICE'; serviceInstanceId: string }
  | { type: 'ADVANCE_ROUTING' }
  | { type: 'SERVER_PASS_REACTION' }
  | { type: 'HOT_SWAP'; appInstanceId: string; targetComputeInstanceId: string }
  | { type: 'AUTO_SCALE' }
  | { type: 'RATE_LIMIT'; computeInstanceId: string }
  | { type: 'CIRCUIT_BREAKER'; computeInstanceId: string }
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

    case 'PLAY_STAMPEDING_HERD':
      return playStampedingherd(state);

    case 'SELECT_EFFECT':
      return selectEffect(state, action.effectType);

    case 'ATTACH_EFFECT':
      return attachEffect(state, action.requestType);

    case 'ROUTE_TO_COMPUTE':
      return routeToCompute(state, action.computeInstanceId);

    case 'ROUTE_TO_STORAGE':
      return routeToStorage(state, action.storageInstanceId);

    case 'ROUTE_TO_SERVICE':
      return routeToService(state, action.serviceInstanceId);

    case 'ADVANCE_ROUTING':
      return advanceRouting(state);

    case 'SERVER_PASS_REACTION':
      return serverPassReaction(state);

    case 'HOT_SWAP':
      return hotSwap(state, action.appInstanceId, action.targetComputeInstanceId);

    case 'AUTO_SCALE':
      return autoScale(state);

    case 'RATE_LIMIT':
      return rateLimit(state, action.computeInstanceId);

    case 'CIRCUIT_BREAKER':
      return circuitBreaker(state, action.computeInstanceId);

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
