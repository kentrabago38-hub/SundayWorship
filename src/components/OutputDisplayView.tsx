import React, { useEffect, useMemo, useState } from 'react';
import {
  applySlidePatchToScenes,
  createSenderId,
  SyncMessage,
} from '../lib/liveSyncChannel';
import { LivePresentationState } from '../types/presentation';
import { SlideCanvas } from './SlideCanvas';

interface OutputDisplayViewProps {
  initialState: LivePresentationState;
  storageKey: string;
  channelName: string;
  onExitInlineFullscreen?: () => void;
}

export const OutputDisplayView: React.FC<OutputDisplayViewProps> = ({
  initialState,
  storageKey,
  channelName,
  onExitInlineFullscreen,
}) => {
  const [state, setState] = useState<LivePresentationState>(initialState);
  const [cursorHidden, setCursorHidden] = useState(false);
  const senderId = useMemo(() => createSenderId(), []);

  // Sync live updates & collaborative edits from any Operator Console via BroadcastChannel
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        const msg = event.data;
        if (!msg || msg.senderId === senderId) return;

        switch (msg.type) {
          case 'FULL_STATE_SYNC':
            if (msg.payload) {
              setState(msg.payload);
            }
            break;
          case 'SLIDE_UPDATED':
            setState((prev) => ({
              ...prev,
              scenes: applySlidePatchToScenes(
                prev.scenes,
                msg.sceneId,
                msg.slideId,
                msg.patch
              ),
              updatedAt: msg.updatedAt,
            }));
            break;
          case 'SETTINGS_UPDATED':
            setState((prev) => ({
              ...prev,
              settings: msg.settings,
              updatedAt: msg.updatedAt,
            }));
            break;
          case 'TIMER_UPDATED':
            setState((prev) => ({
              ...prev,
              serviceTimer: msg.serviceTimer,
              updatedAt: msg.updatedAt,
            }));
            break;
          case 'SCENES_REPLACED':
            setState((prev) => ({
              ...prev,
              scenes: msg.scenes,
              activeSceneId: msg.activeSceneId,
              activeSlideId: msg.activeSlideId,
              updatedAt: msg.updatedAt,
            }));
            break;
          case 'LIVE_CUE_CHANGED':
            setState((prev) => ({
              ...prev,
              activeSceneId: msg.activeSceneId,
              activeSlideId: msg.activeSlideId,
              override: msg.override,
              autoScrollPlayback: msg.autoScrollPlayback,
              updatedAt: msg.updatedAt,
            }));
            break;
          case 'PRESENCE_PING':
            channel?.postMessage({
              type: 'PRESENCE_PONG',
              senderId,
              role: 'tv-output',
            } satisfies SyncMessage);
            break;
        }
      };

      channel.postMessage({
        type: 'PRESENCE_PONG',
        senderId,
        role: 'tv-output',
      } satisfies SyncMessage);
      channel.postMessage({
        type: 'REQUEST_SYNC',
        senderId,
        role: 'tv-output',
      } satisfies SyncMessage);
    }

    const handleBeforeUnload = () => {
      channel?.postMessage({
        type: 'PRESENCE_LEAVE',
        senderId,
        role: 'tv-output',
      } satisfies SyncMessage);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setState(JSON.parse(e.newValue));
        } catch {
          // Ignore malformed storage payload
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('storage', handleStorage);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorage);
      channel?.close();
    };
  }, [channelName, storageKey, senderId]);

  // Hide mouse cursor automatically on the extended TV/projector screen
  useEffect(() => {
    let timeout: number;
    const resetTimer = () => {
      setCursorHidden(false);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setCursorHidden(true), 1800);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
    };
  }, []);

  // Allow Esc key to exit inline fullscreen mode if used on single screen
  useEffect(() => {
    if (!onExitInlineFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitInlineFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExitInlineFullscreen]);

  const activeScene =
    state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0];
  const activeSlide =
    activeScene.slides.find((sl) => sl.id === state.activeSlideId) ||
    activeScene.slides[0];
  const openingSlide = state.scenes[0]?.slides[0];

  const handleStageClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      onClick={handleStageClick}
      className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden ${
        cursorHidden ? 'cursor-none' : 'cursor-default'
      }`}
    >
      <SlideCanvas
        slide={activeSlide}
        openingSlide={openingSlide}
        settings={state.settings}
        override={state.override}
        showSafeGuides={false}
        isOutputDisplay={true}
        autoScrollPlayback={state.autoScrollPlayback}
        serviceTimer={state.serviceTimer}
      />
    </div>
  );
};
