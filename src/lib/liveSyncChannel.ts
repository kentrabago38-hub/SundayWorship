import {
  AutoScrollPlaybackState,
  LivePresentationState,
  OutputOverride,
  ServiceScene,
  ServiceSettings,
  ServiceTimerState,
  SlideData,
} from '../types/presentation';

export const STORAGE_KEY = 'sanctuary-live-presentation-v1';
export const CHANNEL_NAME = 'sanctuary-live-sync';

export type ClientRole = 'operator' | 'tv-output' | 'stage-monitor';

export type SyncMessage =
  | {
      type: 'REQUEST_SYNC';
      senderId: string;
      role: ClientRole;
    }
  | {
      type: 'FULL_STATE_SYNC';
      senderId: string;
      role: ClientRole;
      payload: LivePresentationState;
    }
  | {
      type: 'SLIDE_UPDATED';
      senderId: string;
      sceneId: string;
      slideId: string;
      patch: Partial<SlideData>;
      updatedAt: number;
    }
  | {
      type: 'SETTINGS_UPDATED';
      senderId: string;
      settings: ServiceSettings;
      updatedAt: number;
    }
  | {
      type: 'TIMER_UPDATED';
      senderId: string;
      serviceTimer: ServiceTimerState;
      updatedAt: number;
    }
  | {
      type: 'SCENES_REPLACED';
      senderId: string;
      scenes: ServiceScene[];
      activeSceneId: string;
      activeSlideId: string;
      updatedAt: number;
    }
  | {
      type: 'LIVE_CUE_CHANGED';
      senderId: string;
      activeSceneId: string;
      activeSlideId: string;
      override: OutputOverride;
      autoScrollPlayback?: AutoScrollPlaybackState;
      updatedAt: number;
    }
  | {
      type: 'PRESENCE_PING';
      senderId: string;
      role: ClientRole;
    }
  | {
      type: 'PRESENCE_PONG';
      senderId: string;
      role: ClientRole;
    }
  | {
      type: 'PRESENCE_LEAVE';
      senderId: string;
      role: ClientRole;
    };

export function createSenderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function applySlidePatchToScenes(
  scenes: ServiceScene[],
  sceneId: string,
  slideId: string,
  patch: Partial<SlideData>
): ServiceScene[] {
  return scenes.map((sc) =>
    sc.id === sceneId
      ? {
          ...sc,
          slides: sc.slides.map((sl) =>
            sl.id === slideId ? { ...sl, ...patch } : sl
          ),
        }
      : sc
  );
}
