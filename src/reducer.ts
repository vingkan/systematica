import type { GameState, GameConfig } from './engine/types';
import { createGame } from './engine/game';
import { playCard, playAppCard, removeCard, endServerTurn } from './engine/server-turn';
import { placeCardFaceDown, attachEffect, takeBackFaceDownCard, detachEffect, endClientTurn } from './engine/client-turn';
import { flipNextCard, stepResolution, advanceResolution } from './engine/resolution';

export type GameAction =
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'PLAY_APP_CARD'; cardId: string; computeInstanceId: string; storageInstanceId: string }
  | { type: 'REMOVE_CARD'; instanceId: string }
  | { type: 'END_SERVER_TURN' }
  | { type: 'PLACE_CARD_FACE_DOWN'; cardId: string }
  | { type: 'ATTACH_EFFECT'; effectCardId: string; faceDownIndex: number }
  | { type: 'TAKE_BACK_CARD'; faceDownIndex: number }
  | { type: 'DETACH_EFFECT'; faceDownIndex: number; effectIndex: number }
  | { type: 'END_CLIENT_TURN' }
  | { type: 'FLIP_NEXT_CARD' }
  | { type: 'STEP_RESOLUTION' }
  | { type: 'ADVANCE_RESOLUTION' }
  | { type: 'RESTART'; config?: GameConfig };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLAY_CARD':
      return playCard(state, action.cardId);
    case 'PLAY_APP_CARD':
      return playAppCard(state, action.cardId, action.computeInstanceId, action.storageInstanceId);
    case 'REMOVE_CARD':
      return removeCard(state, action.instanceId);
    case 'END_SERVER_TURN':
      return endServerTurn(state);
    case 'PLACE_CARD_FACE_DOWN':
      return placeCardFaceDown(state, action.cardId);
    case 'ATTACH_EFFECT':
      return attachEffect(state, action.effectCardId, action.faceDownIndex);
    case 'TAKE_BACK_CARD':
      return takeBackFaceDownCard(state, action.faceDownIndex);
    case 'DETACH_EFFECT':
      return detachEffect(state, action.faceDownIndex, action.effectIndex);
    case 'END_CLIENT_TURN':
      return endClientTurn(state);
    case 'FLIP_NEXT_CARD':
      return flipNextCard(state);
    case 'STEP_RESOLUTION':
      return stepResolution(state);
    case 'ADVANCE_RESOLUTION':
      return advanceResolution(state);
    case 'RESTART':
      return createGame(action.config);
    default:
      return state;
  }
}
