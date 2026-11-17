import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  FileDown,
  Home,
  LayoutGrid,
  Maximize2,
  Monitor,
  MonitorUp,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Scan,
  Search,
  Sparkles,
} from 'lucide-react';
import { OutputDisplayView } from './components/OutputDisplayView';
import { StageMonitorView } from './components/StageMonitorView';
import {
  estimateAutoScrollMetrics,
  getDefaultTransitionDuration,
  getDefaultTransitionType,
  SlideCanvas,
} from './components/SlideCanvas';
import {
  createDefaultServiceTimer,
  ServiceTimerWidget,
} from './components/ServiceTimerWidget';
import { SlideInspector } from './components/SlideInspector';
import {
  FreeShowExportModal,
  TemplateModal,
} from './components/TemplatesAndExportModal';
import {
  DEFAULT_SCENES,
  DEFAULT_SETTINGS,
  TEMPLATE_LIBRARY,
} from './data/defaultService';
import {
  applySlidePatchToScenes,
  CHANNEL_NAME,
  createSenderId,
  STORAGE_KEY,
  SyncMessage,
} from './lib/liveSyncChannel';
import {
  AtmosphericLoopId,
  LivePresentationState,
  OutputOverride,
  ServicePart,
  ServiceScene,
  ServiceSettings,
  ServiceTimerState,
  SlideData,
  SlideTransitionType,
  TemplateCategory,
} from './types/presentation';

function createPlaybackForSlide(slide?: SlideData) {
  if (!slide || slide.layout !== 'lyric' || !slide.autoScrollEnabled) {
    return undefined;
  }
  const autoStart = slide.autoScrollAutoStart ?? true;
  return {
    slideId: slide.id,
    isPlaying: autoStart,
    startedAt: autoStart ? Date.now() : null,
    pausedElapsedMs: 0,
  };
}

function loadInitialState(): LivePresentationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LivePresentationState;
      if (parsed?.scenes?.length > 0 && parsed?.settings) {
        // Ensure existing saved state gets the default auto-scroll showcase slide if not present yet
        const defaultSong3 = DEFAULT_SCENES.find((s) => s.id === 'scene-15-song-03');
        const defaultAutoScrollSlide = defaultSong3?.slides.find(
          (sl) => sl.id === 'slide-15-4'
        );
        if (defaultAutoScrollSlide) {
          parsed.scenes = parsed.scenes.map((sc) => {
            if (
              sc.id === 'scene-15-song-03' &&
              !sc.slides.some((sl) => sl.autoScrollEnabled)
            ) {
              return { ...sc, slides: [...sc.slides, defaultAutoScrollSlide] };
            }
            return sc;
          });
        }
        if (!parsed.serviceTimer) {
          parsed.serviceTimer = createDefaultServiceTimer();
        }
        return parsed;
      }
    }
  } catch {
    // Fallback cleanly to default rundown
  }
  return {
    settings: DEFAULT_SETTINGS,
    scenes: DEFAULT_SCENES,
    activeSceneId: DEFAULT_SCENES[0].id,
    activeSlideId: DEFAULT_SCENES[0].slides[0].id,
    override: 'live',
    serviceTimer: createDefaultServiceTimer(),
    updatedAt: Date.now(),
  };
}

const PART_LABELS: { part: ServicePart; label: string }[] = [
  { part: 'opening', label: 'Opening' },
  { part: 'part1', label: 'Part 1 — Church Community' },
  { part: 'part2', label: 'Part 2 — Worship & The Word' },
  { part: 'closing', label: 'Final Screen' },
];

export default function App() {
  const displayMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('display');
  }, []);
  const isTvOutputRoute = displayMode === 'tv';
  const isStageMonitorRoute = displayMode === 'stage';
  const isDisplayClientRoute = isTvOutputRoute || isStageMonitorRoute;

  const [state, setState] = useState<LivePresentationState>(loadInitialState);
  const [focusSceneId, setFocusSceneId] = useState<string>(
    () => state.activeSceneId
  );
  const [focusSlideId, setFocusSlideId] = useState<string>(
    () => state.activeSlideId
  );
  const [syncLivePreview, setSyncLivePreview] = useState<boolean>(true);
  const [connectedTvCount, setConnectedTvCount] = useState<number>(0);
  const [connectedStageCount, setConnectedStageCount] = useState<number>(0);

  const [partFilter, setPartFilter] = useState<'all' | 'part1' | 'part2'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSafeGuides, setShowSafeGuides] = useState(true);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isInlineFullscreen, setIsInlineFullscreen] = useState(false);

  const senderId = useMemo(() => createSenderId(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const tvPeersRef = useRef<Map<string, number>>(new Map());
  const stagePeersRef = useRef<Map<string, number>>(new Map());

  const broadcastMessage = useCallback(
    (msg: SyncMessage) => {
      channelRef.current?.postMessage(msg);
    },
    []
  );

  // Real-time collaborative BroadcastChannel listener & display presence tracking
  useEffect(() => {
    if (isDisplayClientRoute) return;

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      const prunePeers = () => {
        const now = Date.now();
        for (const [id, lastSeen] of tvPeersRef.current.entries()) {
          if (now - lastSeen > 12000) {
            tvPeersRef.current.delete(id);
          }
        }
        for (const [id, lastSeen] of stagePeersRef.current.entries()) {
          if (now - lastSeen > 12000) {
            stagePeersRef.current.delete(id);
          }
        }
        setConnectedTvCount(tvPeersRef.current.size);
        setConnectedStageCount(stagePeersRef.current.size);
      };

      channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        const msg = event.data;
        if (!msg || msg.senderId === senderId) return;

        switch (msg.type) {
          case 'REQUEST_SYNC':
            channel.postMessage({
              type: 'FULL_STATE_SYNC',
              senderId,
              role: 'operator',
              payload: stateRef.current,
            } satisfies SyncMessage);
            break;

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

          case 'PRESENCE_PONG':
            if (msg.role === 'tv-output') {
              tvPeersRef.current.set(msg.senderId, Date.now());
              setConnectedTvCount(tvPeersRef.current.size);
            } else if (msg.role === 'stage-monitor') {
              stagePeersRef.current.set(msg.senderId, Date.now());
              setConnectedStageCount(stagePeersRef.current.size);
            }
            break;

          case 'PRESENCE_LEAVE':
            if (msg.role === 'tv-output') {
              tvPeersRef.current.delete(msg.senderId);
              setConnectedTvCount(tvPeersRef.current.size);
            } else if (msg.role === 'stage-monitor') {
              stagePeersRef.current.delete(msg.senderId);
              setConnectedStageCount(stagePeersRef.current.size);
            }
            break;
        }
      };

      const ping = () => {
        prunePeers();
        channel.postMessage({
          type: 'PRESENCE_PING',
          senderId,
          role: 'operator',
        } satisfies SyncMessage);
      };

      ping();
      const interval = window.setInterval(ping, 4000);

      return () => {
        window.clearInterval(interval);
        channel.close();
        channelRef.current = null;
      };
    }
  }, [isDisplayClientRoute, senderId]);

  useEffect(() => {
    if (isDisplayClientRoute) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state, isDisplayClientRoute]);

  // Listen to browser fullscreen exit
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isInlineFullscreen) {
        setIsInlineFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isInlineFullscreen]);

  const activeScene = useMemo(
    () =>
      state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0],
    [state.scenes, state.activeSceneId]
  );

  const activeSlide = useMemo(
    () =>
      activeScene.slides.find((sl) => sl.id === state.activeSlideId) ||
      activeScene.slides[0],
    [activeScene, state.activeSlideId]
  );

  const focusScene = useMemo(
    () =>
      state.scenes.find((s) => s.id === focusSceneId) || activeScene,
    [state.scenes, focusSceneId, activeScene]
  );

  const focusSlide = useMemo(
    () =>
      focusScene.slides.find((sl) => sl.id === focusSlideId) ||
      focusScene.slides[0],
    [focusScene, focusSlideId]
  );

  const openingSlide = state.scenes[0]?.slides[0];

  const pushLiveCue = useCallback(
    (
      nextActiveSceneId: string,
      nextActiveSlideId: string,
      nextOverride: OutputOverride,
      nextPlayback: LivePresentationState['autoScrollPlayback'],
      now: number
    ) => {
      broadcastMessage({
        type: 'LIVE_CUE_CHANGED',
        senderId,
        activeSceneId: nextActiveSceneId,
        activeSlideId: nextActiveSlideId,
        override: nextOverride,
        autoScrollPlayback: nextPlayback,
        updatedAt: now,
      });
    },
    [broadcastMessage, senderId]
  );

  // Send a specific scene + slide Live to the TV Output Display
  const takeSlideLive = useCallback(
    (sceneId: string, slideId: string) => {
      const now = Date.now();
      setFocusSceneId(sceneId);
      setFocusSlideId(slideId);
      setState((prev) => {
        const targetScene = prev.scenes.find((s) => s.id === sceneId);
        const targetSlide = targetScene?.slides.find((sl) => sl.id === slideId);
        const nextOverride =
          prev.override === 'hold-opening' ? 'live' : prev.override;
        const nextPlayback = createPlaybackForSlide(targetSlide);
        pushLiveCue(sceneId, slideId, nextOverride, nextPlayback, now);
        return {
          ...prev,
          activeSceneId: sceneId,
          activeSlideId: slideId,
          override: nextOverride,
          autoScrollPlayback: nextPlayback,
          updatedAt: now,
        };
      });
    },
    [pushLiveCue]
  );

  // Select slide in Cue Grid: synced to Active when syncLivePreview=true, Focus-only when false
  const selectSlide = useCallback(
    (sceneId: string, slideId: string) => {
      setFocusSceneId(sceneId);
      setFocusSlideId(slideId);
      if (syncLivePreview) {
        takeSlideLive(sceneId, slideId);
      }
    },
    [syncLivePreview, takeSlideLive]
  );

  // Select scene in Rundown: synced to Active when syncLivePreview=true, Focus-only when false
  const selectScene = useCallback(
    (scene: ServiceScene) => {
      const firstSlideId = scene.slides[0]?.id || '';
      setFocusSceneId(scene.id);
      setFocusSlideId(firstSlideId);
      if (syncLivePreview) {
        takeSlideLive(scene.id, firstSlideId);
      }
    },
    [syncLivePreview, takeSlideLive]
  );

  // Toggle between Active (synced live preview) and Focus (independent edit preview)
  const handleSetSyncLivePreview = useCallback(
    (nextSync: boolean) => {
      setSyncLivePreview(nextSync);
      if (nextSync) {
        setFocusSceneId(stateRef.current.activeSceneId);
        setFocusSlideId(stateRef.current.activeSlideId);
      }
    },
    []
  );

  const stepSlide = useCallback(
    (direction: 1 | -1) => {
      const now = Date.now();
      setState((prev) => {
        const sIdx = prev.scenes.findIndex((s) => s.id === prev.activeSceneId);
        if (sIdx === -1) return prev;
        const currentScene = prev.scenes[sIdx];
        const slIdx = currentScene.slides.findIndex(
          (sl) => sl.id === prev.activeSlideId
        );

        let nextSceneId = prev.activeSceneId;
        let nextSlide: SlideData | undefined;

        if (direction === 1) {
          if (slIdx + 1 < currentScene.slides.length) {
            nextSlide = currentScene.slides[slIdx + 1];
          } else if (sIdx + 1 < prev.scenes.length) {
            const nextScene = prev.scenes[sIdx + 1];
            nextSceneId = nextScene.id;
            nextSlide = nextScene.slides[0];
          }
        } else {
          if (slIdx - 1 >= 0) {
            nextSlide = currentScene.slides[slIdx - 1];
          } else if (sIdx - 1 >= 0) {
            const prevScene = prev.scenes[sIdx - 1];
            nextSceneId = prevScene.id;
            nextSlide = prevScene.slides[prevScene.slides.length - 1];
          }
        }

        if (!nextSlide) return prev;
        const nextPlayback = createPlaybackForSlide(nextSlide);
        if (syncLivePreview) {
          setFocusSceneId(nextSceneId);
          setFocusSlideId(nextSlide.id);
        }
        pushLiveCue(nextSceneId, nextSlide.id, 'live', nextPlayback, now);
        return {
          ...prev,
          activeSceneId: nextSceneId,
          activeSlideId: nextSlide.id,
          override: 'live',
          autoScrollPlayback: nextPlayback,
          updatedAt: now,
        };
      });
    },
    [pushLiveCue, syncLivePreview]
  );

  const stepScene = useCallback(
    (direction: 1 | -1) => {
      const now = Date.now();
      setState((prev) => {
        const sIdx = prev.scenes.findIndex((s) => s.id === prev.activeSceneId);
        const nextIdx = sIdx + direction;
        if (nextIdx >= 0 && nextIdx < prev.scenes.length) {
          const nextScene = prev.scenes[nextIdx];
          const nextSlide = nextScene.slides[0];
          const nextPlayback = createPlaybackForSlide(nextSlide);
          if (syncLivePreview) {
            setFocusSceneId(nextScene.id);
            setFocusSlideId(nextSlide.id);
          }
          pushLiveCue(nextScene.id, nextSlide.id, 'live', nextPlayback, now);
          return {
            ...prev,
            activeSceneId: nextScene.id,
            activeSlideId: nextSlide.id,
            override: 'live',
            autoScrollPlayback: nextPlayback,
            updatedAt: now,
          };
        }
        return prev;
      });
    },
    [pushLiveCue, syncLivePreview]
  );

  const toggleAutoScrollPlay = useCallback(() => {
    const now = Date.now();
    setState((prev) => {
      const sc = prev.scenes.find((s) => s.id === prev.activeSceneId);
      const sl = sc?.slides.find((item) => item.id === prev.activeSlideId);
      if (!sl?.autoScrollEnabled) return prev;

      const durationMs = Math.max(10, sl.autoScrollDurationSec ?? 180) * 1000;
      const pb = prev.autoScrollPlayback;
      let nextPlayback: LivePresentationState['autoScrollPlayback'];

      if (!pb || pb.slideId !== sl.id) {
        nextPlayback = {
          slideId: sl.id,
          isPlaying: true,
          startedAt: now,
          pausedElapsedMs: 0,
        };
      } else if (pb.isPlaying && pb.startedAt !== null) {
        const elapsed = Math.min(
          durationMs,
          pb.pausedElapsedMs + (now - pb.startedAt)
        );
        nextPlayback = {
          slideId: sl.id,
          isPlaying: false,
          startedAt: null,
          pausedElapsedMs: elapsed,
        };
      } else {
        const startElapsed =
          pb.pausedElapsedMs >= durationMs ? 0 : pb.pausedElapsedMs;
        nextPlayback = {
          slideId: sl.id,
          isPlaying: true,
          startedAt: now,
          pausedElapsedMs: startElapsed,
        };
      }

      pushLiveCue(
        prev.activeSceneId,
        prev.activeSlideId,
        prev.override,
        nextPlayback,
        now
      );
      return {
        ...prev,
        autoScrollPlayback: nextPlayback,
        updatedAt: now,
      };
    });
  }, [pushLiveCue]);

  const restartAutoScroll = useCallback(() => {
    const now = Date.now();
    setState((prev) => {
      const sc = prev.scenes.find((s) => s.id === prev.activeSceneId);
      const sl = sc?.slides.find((item) => item.id === prev.activeSlideId);
      if (!sl?.autoScrollEnabled) return prev;
      const nextPlayback = {
        slideId: sl.id,
        isPlaying: true,
        startedAt: now,
        pausedElapsedMs: 0,
      };
      pushLiveCue(
        prev.activeSceneId,
        prev.activeSlideId,
        prev.override,
        nextPlayback,
        now
      );
      return {
        ...prev,
        autoScrollPlayback: nextPlayback,
        updatedAt: now,
      };
    });
  }, [pushLiveCue]);

  const seekAutoScroll = useCallback(
    (elapsedMs: number) => {
      const now = Date.now();
      setState((prev) => {
        const sc = prev.scenes.find((s) => s.id === prev.activeSceneId);
        const sl = sc?.slides.find((item) => item.id === prev.activeSlideId);
        if (!sl?.autoScrollEnabled) return prev;
        const wasPlaying =
          prev.autoScrollPlayback?.slideId === sl.id &&
          prev.autoScrollPlayback.isPlaying;
        const nextPlayback = {
          slideId: sl.id,
          isPlaying: wasPlaying,
          startedAt: wasPlaying ? now : null,
          pausedElapsedMs: elapsedMs,
        };
        pushLiveCue(
          prev.activeSceneId,
          prev.activeSlideId,
          prev.override,
          nextPlayback,
          now
        );
        return {
          ...prev,
          autoScrollPlayback: nextPlayback,
          updatedAt: now,
        };
      });
    },
    [pushLiveCue]
  );

  const toggleOverride = useCallback(
    (mode: OutputOverride) => {
      const now = Date.now();
      setState((prev) => {
        const nextOverride = prev.override === mode ? 'live' : mode;
        pushLiveCue(
          prev.activeSceneId,
          prev.activeSlideId,
          nextOverride,
          prev.autoScrollPlayback,
          now
        );
        return {
          ...prev,
          override: nextOverride,
          updatedAt: now,
        };
      });
    },
    [pushLiveCue]
  );

  const enterFullscreenPresentation = useCallback(() => {
    setIsInlineFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const exitFullscreenPresentation = useCallback(() => {
    setIsInlineFullscreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Live Keyboard Shortcuts for Operator Control
  useEffect(() => {
    if (isDisplayClientRoute) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        stepSlide(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepSlide(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepScene(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepScene(-1);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleOverride('blackout');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleOverride('clear-text');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        toggleOverride('hold-opening');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (isInlineFullscreen) {
          exitFullscreenPresentation();
        } else {
          enterFullscreenPresentation();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        toggleAutoScrollPlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDisplayClientRoute,
    isInlineFullscreen,
    stepSlide,
    stepScene,
    toggleOverride,
    toggleAutoScrollPlay,
    enterFullscreenPresentation,
    exitFullscreenPresentation,
  ]);

  // If opened as Extended TV / Projector Window (?display=tv), show pure 16:9 display
  if (isTvOutputRoute) {
    return (
      <OutputDisplayView
        initialState={state}
        storageKey={STORAGE_KEY}
        channelName={CHANNEL_NAME}
      />
    );
  }

  // If opened as Worship Team Stage Monitor (?display=stage), show high-contrast confidence display
  if (isStageMonitorRoute) {
    return (
      <StageMonitorView
        initialState={state}
        storageKey={STORAGE_KEY}
        channelName={CHANNEL_NAME}
      />
    );
  }

  // If operator clicked Present Live on single screen
  if (isInlineFullscreen) {
    return (
      <OutputDisplayView
        initialState={state}
        storageKey={STORAGE_KEY}
        channelName={CHANNEL_NAME}
        onExitInlineFullscreen={exitFullscreenPresentation}
      />
    );
  }

  const updateSettings = (settings: ServiceSettings) => {
    const now = Date.now();
    broadcastMessage({
      type: 'SETTINGS_UPDATED',
      senderId,
      settings,
      updatedAt: now,
    });
    setState((prev) => ({ ...prev, settings, updatedAt: now }));
  };

  const updateServiceTimer = (serviceTimer: ServiceTimerState) => {
    const now = Date.now();
    broadcastMessage({
      type: 'TIMER_UPDATED',
      senderId,
      serviceTimer,
      updatedAt: now,
    });
    setState((prev) => ({ ...prev, serviceTimer, updatedAt: now }));
  };

  const applyBackdropToScene = (backgroundImage?: string) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetSceneId
          ? {
              ...sc,
              slides: sc.slides.map((sl) => ({
                ...sl,
                backgroundImage: backgroundImage || undefined,
              })),
            }
          : sc
      );
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: prev.activeSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        updatedAt: now,
      };
    });
  };

  const applyLoopToScene = (atmosphericLoop: AtmosphericLoopId) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetSceneId
          ? {
              ...sc,
              slides: sc.slides.map((sl) => ({
                ...sl,
                atmosphericLoop,
              })),
            }
          : sc
      );
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: prev.activeSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        updatedAt: now,
      };
    });
  };

  const applyTransitionToScene = (
    transitionType: SlideTransitionType,
    transitionDurationSec: number
  ) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetSceneId
          ? {
              ...sc,
              slides: sc.slides.map((sl) => ({
                ...sl,
                transitionType,
                transitionDurationSec,
              })),
            }
          : sc
      );
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: prev.activeSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        updatedAt: now,
      };
    });
  };

  // Immediate collaborative BroadcastChannel sync for any slide edit
  const updateSlide = (slideId: string, patch: Partial<SlideData>) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    broadcastMessage({
      type: 'SLIDE_UPDATED',
      senderId,
      sceneId: targetSceneId,
      slideId,
      patch,
      updatedAt: now,
    });
    setState((prev) => {
      const updatedScenes = applySlidePatchToScenes(
        prev.scenes,
        targetSceneId,
        slideId,
        patch
      );
      let nextPlayback = prev.autoScrollPlayback;
      if (slideId === prev.activeSlideId && 'autoScrollEnabled' in patch) {
        const updatedSlide = updatedScenes
          .find((sc) => sc.id === targetSceneId)
          ?.slides.find((sl) => sl.id === slideId);
        nextPlayback = createPlaybackForSlide(updatedSlide);
        pushLiveCue(
          prev.activeSceneId,
          prev.activeSlideId,
          prev.override,
          nextPlayback,
          now
        );
      }
      return {
        ...prev,
        scenes: updatedScenes,
        autoScrollPlayback: nextPlayback,
        updatedAt: now,
      };
    });
  };

  const duplicateSlide = (slideId: string) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const targetScene = prev.scenes.find((s) => s.id === targetSceneId);
      if (!targetScene) return prev;
      const idx = targetScene.slides.findIndex((sl) => sl.id === slideId);
      if (idx === -1) return prev;
      const original = targetScene.slides[idx];
      const copy: SlideData = {
        ...original,
        id: `slide-copy-${now}`,
        label: `${original.label} (Copy)`,
      };
      const nextSlides = [...targetScene.slides];
      nextSlides.splice(idx + 1, 0, copy);
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetScene.id ? { ...sc, slides: nextSlides } : sc
      );
      const nextActiveSlideId = syncLivePreview ? copy.id : prev.activeSlideId;
      setFocusSlideId(copy.id);
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      };
    });
  };

  const addQuickSlideToScene = () => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const targetScene = prev.scenes.find((s) => s.id === targetSceneId);
      if (!targetScene) return prev;
      const template = targetScene.slides[targetScene.slides.length - 1];
      const nextNum = targetScene.slides.length + 1;
      const created: SlideData = {
        ...template,
        id: `slide-add-${now}`,
        label:
          template.layout === 'lyric'
            ? `Lyric ${String(nextNum).padStart(2, '0')}`
            : template.layout === 'scripture-reading'
              ? `Scripture ${String(nextNum).padStart(2, '0')}`
              : template.layout === 'announcement-item'
                ? `Announcement ${String(nextNum).padStart(2, '0')}`
                : `Slide ${String(nextNum).padStart(2, '0')}`,
      };
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetScene.id
          ? { ...sc, slides: [...sc.slides, created] }
          : sc
      );
      const nextActiveSlideId = syncLivePreview ? created.id : prev.activeSlideId;
      setFocusSlideId(created.id);
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      };
    });
  };

  const deleteSlide = (slideId: string) => {
    const now = Date.now();
    const targetSceneId = focusScene.id;
    setState((prev) => {
      const targetScene = prev.scenes.find((s) => s.id === targetSceneId);
      if (!targetScene || targetScene.slides.length <= 1) return prev;
      const remaining = targetScene.slides.filter((sl) => sl.id !== slideId);
      const nextActiveSlide =
        prev.activeSlideId === slideId ? remaining[0].id : prev.activeSlideId;
      if (focusSlideId === slideId) {
        setFocusSlideId(remaining[0].id);
      }
      const nextScenes = prev.scenes.map((sc) =>
        sc.id === targetScene.id ? { ...sc, slides: remaining } : sc
      );
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: prev.activeSceneId,
        activeSlideId: nextActiveSlide,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        activeSlideId: nextActiveSlide,
        updatedAt: now,
      };
    });
  };

  const insertCustomScene = (
    createScene: (nextCode: string) => ServiceScene
  ) => {
    const now = Date.now();
    setState((prev) => {
      const nextCode = String(prev.scenes.length + 1).padStart(2, '0');
      const created = createScene(nextCode);
      const nextScenes = [...prev.scenes, created];
      const nextActiveSceneId = syncLivePreview ? created.id : prev.activeSceneId;
      const nextActiveSlideId = syncLivePreview
        ? created.slides[0].id
        : prev.activeSlideId;
      setFocusSceneId(created.id);
      setFocusSlideId(created.slides[0].id);
      if (
        (partFilter === 'part1' &&
          (created.part === 'part2' || created.part === 'closing')) ||
        (partFilter === 'part2' &&
          (created.part === 'opening' || created.part === 'part1'))
      ) {
        setPartFilter('all');
      }
      broadcastMessage({
        type: 'SCENES_REPLACED',
        senderId,
        scenes: nextScenes,
        activeSceneId: nextActiveSceneId,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      });
      return {
        ...prev,
        scenes: nextScenes,
        activeSceneId: nextActiveSceneId,
        activeSlideId: nextActiveSlideId,
        updatedAt: now,
      };
    });
  };

  const insertTemplateScene = (category: TemplateCategory) => {
    const tpl = TEMPLATE_LIBRARY.find((t) => t.id === category);
    if (!tpl) return;
    insertCustomScene(tpl.createScene);
  };

  const resetToDefaultService = () => {
    const now = Date.now();
    const nextState: LivePresentationState = {
      settings: DEFAULT_SETTINGS,
      scenes: DEFAULT_SCENES,
      activeSceneId: DEFAULT_SCENES[0].id,
      activeSlideId: DEFAULT_SCENES[0].slides[0].id,
      override: 'live',
      serviceTimer: createDefaultServiceTimer(),
      updatedAt: now,
    };
    setFocusSceneId(DEFAULT_SCENES[0].id);
    setFocusSlideId(DEFAULT_SCENES[0].slides[0].id);
    setState(nextState);
    broadcastMessage({
      type: 'FULL_STATE_SYNC',
      senderId,
      role: 'operator',
      payload: nextState,
    });
  };

  const filteredScenes = state.scenes.filter((sc) => {
    const matchesPart =
      partFilter === 'all' ||
      (partFilter === 'part1' && (sc.part === 'opening' || sc.part === 'part1')) ||
      (partFilter === 'part2' && (sc.part === 'part2' || sc.part === 'closing'));
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sc.name.toLowerCase().includes(q) ||
      sc.code.includes(q) ||
      sc.category.toLowerCase().includes(q);
    return matchesPart && matchesSearch;
  });

  const displayedScene = syncLivePreview ? activeScene : focusScene;
  const displayedSlide = syncLivePreview ? activeSlide : focusSlide;
  const displayedSlideIndex = displayedScene.slides.findIndex(
    (s) => s.id === displayedSlide.id
  );
  const isFocusCurrentlyLive =
    focusScene.id === activeScene.id && focusSlide.id === activeSlide.id;

  const nextUpCue = useMemo(() => {
    if (
      displayedSlideIndex >= 0 &&
      displayedSlideIndex < displayedScene.slides.length - 1
    ) {
      return {
        scene: displayedScene,
        slide: displayedScene.slides[displayedSlideIndex + 1],
      };
    }
    const sceneIdx = state.scenes.findIndex((s) => s.id === displayedScene.id);
    if (sceneIdx >= 0 && sceneIdx < state.scenes.length - 1) {
      const nextScene = state.scenes[sceneIdx + 1];
      if (nextScene.slides.length > 0) {
        return {
          scene: nextScene,
          slide: nextScene.slides[0],
        };
      }
    }
    return null;
  }, [displayedScene, displayedSlideIndex, state.scenes]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07080B] text-[#F5F3EE] overflow-hidden">
      {/* Three-Zone Top Bar with Service Clock & Countdown Timer */}
      <header className="h-14 shrink-0 px-5 border-b border-white/[0.08] bg-[#0A0C11] flex items-center justify-between gap-4">
        {/* Zone 1: Single-line Wordmark */}
        <span className="font-serif text-xl font-semibold tracking-tight text-[#FAF8F4] whitespace-nowrap shrink-0">
          Sanctuary Live
        </span>

        {/* Zone 2: Concise single-line navigation controls */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-[#94A3B8]">
          <button
            type="button"
            onClick={() => setPartFilter('all')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded-sm ${
              partFilter === 'all'
                ? 'text-[#FAF8F4] border-[#D4AF63]'
                : 'border-transparent hover:text-white'
            }`}
          >
            All Scenes
          </button>
          <button
            type="button"
            onClick={() => setPartFilter('part1')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded-sm ${
              partFilter === 'part1'
                ? 'text-[#FAF8F4] border-[#D4AF63]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Part 1 Community
          </button>
          <button
            type="button"
            onClick={() => setPartFilter('part2')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded-sm ${
              partFilter === 'part2'
                ? 'text-[#FAF8F4] border-[#D4AF63]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Part 2 Worship
          </button>
          <button
            type="button"
            onClick={() => setIsTemplateOpen(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded-sm"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded-sm"
          >
            FreeShow Export
          </button>
        </nav>

        {/* Zone 3: Service Clock & Countdown Timer + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ServiceTimerWidget
            timer={state.serviceTimer || createDefaultServiceTimer()}
            onChange={updateServiceTimer}
          />
          <button
            type="button"
            onClick={enterFullscreenPresentation}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#D4AF63] hover:bg-[#E2BF76] text-xs font-semibold text-[#0A0B0E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Present Fullscreen
          </button>
        </div>
      </header>

      {/* Main Three-Column Operator Studio */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Rail: FreeShow Service Rundown */}
        <aside className="w-[272px] xl:w-[292px] shrink-0 border-r border-white/[0.08] bg-[#0D0F14] flex flex-col min-h-0">
          <div className="p-3 border-b border-white/[0.08] bg-[#0A0C11] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-[#CBD5E1]">
                Service Rundown
              </span>
              <span className="text-[11px] font-mono text-[#64748B] tabular-nums">
                {state.scenes.length} scenes
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter scenes or songs..."
                aria-label="Filter service scenes"
                className="w-full bg-[#12151E] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#FAF8F4] placeholder-[#64748B] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto operator-scroll p-2.5 space-y-5">
            {PART_LABELS.map(({ part, label }) => {
              const partScenes = filteredScenes.filter((s) => s.part === part);
              if (partScenes.length === 0) return null;

              return (
                <div key={part}>
                  <div className="px-2 pb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-[#94A3B8]">
                      {label}
                    </p>
                    <span className="text-[10px] font-mono text-[#475569] tabular-nums">
                      {partScenes.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {partScenes.map((scene) => {
                      const isFocused = scene.id === focusScene.id;
                      const isLiveScene = scene.id === activeScene.id;
                      return (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => selectScene(scene)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                            isFocused
                              ? 'bg-[#D4AF63]/14 text-[#FAF8F4] border border-[#D4AF63]/45'
                              : 'text-[#CBD5E1] hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`text-[11px] font-mono tabular-nums shrink-0 ${
                                isFocused ? 'text-[#E8C988]' : 'text-[#64748B]'
                              }`}
                            >
                              {scene.code}
                            </span>
                            <span className="text-xs font-medium truncate">
                              {scene.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isLiveScene && !syncLivePreview && (
                              <span className="text-[10px] font-mono font-semibold text-emerald-400">
                                LIVE
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-[#64748B] tabular-nums">
                              {scene.slides.length}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rundown Footer Actions */}
          <div className="p-3 border-t border-white/[0.08] bg-[#0A0C11] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTemplateOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#12151E] hover:bg-[#191E2A] border border-white/10 text-xs font-medium text-[#FAF8F4] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF63]" />
              Add Scene
            </button>
            <button
              type="button"
              onClick={resetToDefaultService}
              title="Reset to default Sunday service"
              className="p-2 rounded-lg bg-[#12151E] hover:bg-[#191E2A] border border-white/10 text-[#94A3B8] hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Center Workspace: Program Monitor + Slide Cue Grid */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#07080B]">
          {/* Program Output Monitor & Live Control Strip */}
          <div className="p-4 lg:p-5 border-b border-white/[0.08] flex flex-col items-center bg-[#0A0C11]">
            <div className="w-full max-w-[800px] space-y-2.5">
              {/* Monitor Header Metadata + Sync Live Preview Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#CBD5E1] min-w-0">
                  <span className="font-semibold text-[#FAF8F4] whitespace-nowrap">
                    {syncLivePreview
                      ? 'Active Live Preview (16:9)'
                      : 'Focus Edit Preview (Off-Air)'}
                  </span>
                  <span className="text-[#475569]" aria-hidden="true">
                    ·
                  </span>
                  <span className="truncate text-[#94A3B8]">
                    {displayedScene.code} — {displayedScene.name} / {displayedSlide.label}
                  </span>
                  <span className="text-[#475569]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-[11px] text-[#E3C17A] tabular-nums whitespace-nowrap shrink-0">
                    {(
                      displayedSlide.transitionDurationSec ??
                      getDefaultTransitionDuration(displayedSlide.layout)
                    ).toFixed(1)}s{' '}
                    {displayedSlide.transitionType ??
                      getDefaultTransitionType(displayedSlide.layout)}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Live BroadcastChannel Output Peer Status */}
                  <span
                    className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                      connectedTvCount > 0 || connectedStageCount > 0
                        ? 'text-emerald-400'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {connectedTvCount > 0 || connectedStageCount > 0
                      ? [
                          connectedTvCount > 0
                            ? `${connectedTvCount} TV`
                            : null,
                          connectedStageCount > 0
                            ? `${connectedStageCount} Stage`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') + ' Synced'
                      : 'BroadcastChannel Ready'}
                  </span>

                  {/* Sync Live Preview Switch (Active vs Focus) */}
                  <div
                    className="flex items-center gap-1 p-0.5 rounded-lg bg-[#12151E] border border-white/10"
                    role="group"
                    aria-label="Sync Live Preview mode"
                  >
                    <span className="px-2 text-[11px] text-[#94A3B8] whitespace-nowrap">
                      Sync Live Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetSyncLivePreview(true)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                        syncLivePreview
                          ? 'bg-[#D4AF63] text-[#0A0B0E]'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetSyncLivePreview(false)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                        !syncLivePreview
                          ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      Focus
                    </button>
                  </div>
                </div>
              </div>

              {/* Off-Air Focus Banner showing what Audience currently sees */}
              {!syncLivePreview && (
                <div className="px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0 text-amber-100">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 shrink-0">
                      On TV Now:
                    </span>
                    <span className="truncate font-medium">
                      {activeScene.code} · {activeScene.name} — {activeSlide.label}
                    </span>
                    <span className="text-white/30" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[11px] text-amber-200/80 whitespace-nowrap tabular-nums">
                      Slide {displayedSlideIndex + 1} of {displayedScene.slides.length}
                    </span>
                  </div>
                  {!isFocusCurrentlyLive && (
                    <button
                      type="button"
                      onClick={() => takeSlideLive(focusScene.id, focusSlide.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D4AF63] hover:bg-[#E2BF76] text-[#0A0B0E] text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70"
                    >
                      <Radio className="w-3 h-3" />
                      Send Focus Live
                    </button>
                  )}
                </div>
              )}

              {/* 16:9 Live Preview Frame */}
              <div
                className={`relative w-full aspect-video rounded-xl overflow-hidden border bg-black shadow-2xl ${
                  syncLivePreview ? 'border-white/15' : 'border-amber-400/45'
                }`}
              >
                <SlideCanvas
                  slide={displayedSlide}
                  openingSlide={openingSlide}
                  settings={state.settings}
                  override={syncLivePreview ? state.override : 'live'}
                  showSafeGuides={showSafeGuides}
                  isOutputDisplay={false}
                  autoScrollPlayback={
                    syncLivePreview || isFocusCurrentlyLive
                      ? state.autoScrollPlayback
                      : undefined
                  }
                  serviceTimer={state.serviceTimer}
                />
              </div>

              {/* Up Next & Slide Position Readout */}
              <div className="flex items-center justify-between gap-4 px-0.5 text-[11px] text-[#94A3B8]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono uppercase tracking-wider text-[10px] text-[#64748B] shrink-0">
                    Up Next
                  </span>
                  {nextUpCue ? (
                    <span className="truncate text-[#CBD5E1]">
                      {nextUpCue.scene.code} {nextUpCue.scene.name} — {nextUpCue.slide.label}
                    </span>
                  ) : (
                    <span className="text-[#64748B]">End of Service Rundown</span>
                  )}
                </div>
                <span className="font-mono text-[#64748B] tabular-nums whitespace-nowrap shrink-0">
                  Slide {displayedSlideIndex + 1}/{displayedScene.slides.length}
                </span>
              </div>

              {/* Auto-Scroll Transport Bar (Controls Active TV Auto-Scroll slide even while editing elsewhere) */}
              {activeSlide.layout === 'lyric' && activeSlide.autoScrollEnabled && (
                <AutoScrollTransportBar
                  slide={activeSlide}
                  playback={state.autoScrollPlayback}
                  onTogglePlay={toggleAutoScrollPlay}
                  onRestart={restartAutoScroll}
                  onSeek={seekAutoScroll}
                />
              )}

              {/* Grouped Operator Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                {/* Transport & Guides */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepSlide(-1)}
                    title="Previous Slide (Left Arrow)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#12151E] hover:bg-[#1B202E] border border-white/10 text-xs font-medium text-[#FAF8F4] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                    <span className="hidden xl:inline text-[10px] font-mono text-white/35 ml-0.5">
                      ←
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => stepSlide(1)}
                    title="Next Slide (Right Arrow / Space)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#12151E] hover:bg-[#1B202E] border border-white/10 text-xs font-medium text-[#FAF8F4] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                  >
                    Next
                    <span className="hidden xl:inline text-[10px] font-mono text-white/35 ml-0.5">
                      →
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSafeGuides((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                      showSafeGuides
                        ? 'bg-[#D4AF63]/15 border-[#D4AF63]/45 text-[#F3DFA8]'
                        : 'bg-[#12151E] border-white/10 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Safe Area
                  </button>
                </div>

                {/* Broadcast Overrides & Output Window */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleOverride('clear-text')}
                    title="Clear Text (C)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                      state.override === 'clear-text'
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-[#12151E] border-white/10 text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Clear Text
                    <span className="hidden xl:inline text-[10px] font-mono text-white/35">
                      C
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOverride('hold-opening')}
                    title="Hold Opening Screen (L)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                      state.override === 'hold-opening'
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-[#12151E] border-white/10 text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    Hold Opening
                    <span className="hidden xl:inline text-[10px] font-mono text-white/35">
                      L
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOverride('blackout')}
                    title="Blackout Display (B)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${
                      state.override === 'blackout'
                        ? 'bg-red-500/25 border-red-400/60 text-red-200'
                        : 'bg-[#12151E] border-white/10 text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Blackout
                    <span className="hidden xl:inline text-[10px] font-mono text-white/35">
                      B
                    </span>
                  </button>

                  <span
                    className="hidden sm:block h-5 w-px bg-white/10 mx-0.5"
                    aria-hidden="true"
                  />

                  <a
                    href="?display=stage"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open Worship Team Stage Monitor (?display=stage)"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#12151E] hover:bg-[#191E2A] text-xs font-medium text-[#CBD5E1] hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                  >
                    <Monitor className="w-3.5 h-3.5 text-[#D4AF63]" />
                    Stage Monitor
                  </a>

                  <a
                    href="?display=tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4AF63]/45 bg-[#D4AF63]/10 hover:bg-[#D4AF63]/20 text-xs font-medium text-[#F3DFA8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                  >
                    <MonitorUp className="w-3.5 h-3.5" />
                    TV Output Window
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Scene Slide Cue Grid */}
          <div className="flex-1 overflow-y-auto operator-scroll p-4 lg:p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="w-4 h-4 text-[#D4AF63] shrink-0" />
                <h2 className="text-sm font-semibold text-[#FAF8F4] truncate">
                  {displayedScene.code} · {displayedScene.name}
                </h2>
                <span className="text-xs text-[#475569]" aria-hidden="true">
                  /
                </span>
                <span className="text-xs text-[#94A3B8] truncate">
                  {displayedScene.category}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12151E] hover:bg-[#191E2A] border border-white/10 text-xs font-medium text-[#CBD5E1] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Cue Sheet
                </button>
                <button
                  type="button"
                  onClick={addQuickSlideToScene}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12151E] hover:bg-[#191E2A] border border-white/10 text-xs font-medium text-[#FAF8F4] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4AF63]" />
                  Add Slide
                </button>
              </div>
            </div>

            {displayedSlide.operatorNote && (
              <div className="mb-4 py-2.5 border-y border-white/[0.08] text-xs text-[#CBD5E1]">
                <span className="font-semibold text-[#E3C17A] mr-2">
                  Operator Note:
                </span>
                {displayedSlide.operatorNote}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {displayedScene.slides.map((sl, index) => {
                const isLive =
                  displayedScene.id === activeScene.id &&
                  sl.id === activeSlide.id &&
                  state.override === 'live';
                const isFocused =
                  displayedScene.id === focusScene.id && sl.id === focusSlide.id;
                const previewText =
                  sl.lines && sl.lines.length > 0
                    ? sl.lines.join(' / ')
                    : sl.body || sl.subtitle || sl.metaPrimary || '';
                const durationLabel = `${(
                  sl.transitionDurationSec ??
                  getDefaultTransitionDuration(sl.layout)
                ).toFixed(1)}s`;
                const transitionTypeLabel =
                  sl.transitionType ?? getDefaultTransitionType(sl.layout);
                const cueTags = [
                  sl.autoScrollEnabled ? 'Scroll' : null,
                  sl.displayStyle === 'lower-third' ? 'Lower-3rd' : null,
                  sl.textScale === 'large' ? 'Large' : null,
                  `${durationLabel} ${transitionTypeLabel}`,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    key={sl.id}
                    className={`group rounded-xl overflow-hidden border transition-colors bg-[#0D0F14] ${
                      isLive
                        ? 'border-[#D4AF63] ring-1 ring-[#D4AF63]/40'
                        : isFocused
                          ? 'border-amber-400/60 ring-1 ring-amber-400/25'
                          : 'border-white/[0.08] hover:border-white/25'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectSlide(displayedScene.id, sl.id)}
                      onDoubleClick={() => takeSlideLive(displayedScene.id, sl.id)}
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF63]/70"
                    >
                      {/* Live Mini 16:9 Canvas Preview */}
                      <div className="relative w-full aspect-video bg-black overflow-hidden pointer-events-none">
                        <SlideCanvas
                          slide={sl}
                          settings={state.settings}
                          override="live"
                          showSafeGuides={false}
                          isOutputDisplay={true}
                        />
                      </div>

                      {/* Cue Card Footer */}
                      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06]">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#FAF8F4] truncate">
                            {String(index + 1).padStart(2, '0')}. {sl.label}
                          </p>
                          <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                            {previewText || sl.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                            {cueTags}
                          </span>
                          {isLive && (
                            <span className="text-[11px] font-mono font-semibold text-emerald-400">
                              LIVE
                            </span>
                          )}
                          {!isLive && isFocused && !syncLivePreview && (
                            <span className="text-[11px] font-mono font-semibold text-amber-300">
                              FOCUS
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Right Inspector: Live Content & Template Editor */}
        <SlideInspector
          scene={focusScene}
          slide={focusSlide}
          isFocusLive={isFocusCurrentlyLive}
          onTakeFocusLive={() => takeSlideLive(focusScene.id, focusSlide.id)}
          settings={state.settings}
          onUpdateSettings={updateSettings}
          onUpdateSlide={updateSlide}
          onApplyBackdropToScene={applyBackdropToScene}
          onApplyLoopToScene={applyLoopToScene}
          onApplyTransitionToScene={applyTransitionToScene}
          onDuplicateSlide={duplicateSlide}
          onDeleteSlide={deleteSlide}
          onAddQuickSlide={addQuickSlideToScene}
        />
      </div>

      {/* Modals */}
      <TemplateModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onInsertTemplate={insertTemplateScene}
        onInsertCustomScene={insertCustomScene}
      />
      <FreeShowExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        scenes={state.scenes}
        settings={state.settings}
      />
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function AutoScrollTransportBar({
  slide,
  playback,
  onTogglePlay,
  onRestart,
  onSeek,
}: {
  slide: SlideData;
  playback?: LivePresentationState['autoScrollPlayback'];
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (elapsedMs: number) => void;
}) {
  const durationSec = Math.max(10, slide.autoScrollDurationSec ?? 180);
  const durationMs = durationSec * 1000;
  const metrics = useMemo(() => estimateAutoScrollMetrics(slide), [slide]);

  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!playback || playback.slideId !== slide.id) {
      setElapsedMs(0);
      return;
    }

    let timer = 0;
    const tick = () => {
      const current =
        playback.isPlaying && playback.startedAt !== null
          ? Math.min(durationMs, playback.pausedElapsedMs + (Date.now() - playback.startedAt))
          : Math.min(durationMs, playback.pausedElapsedMs);
      setElapsedMs(current);
      if (playback.isPlaying && current < durationMs) {
        timer = window.requestAnimationFrame(tick);
      }
    };
    tick();
    return () => {
      if (timer) window.cancelAnimationFrame(timer);
    };
  }, [playback, slide.id, durationMs]);

  const isPlaying =
    Boolean(playback && playback.slideId === slide.id && playback.isPlaying) &&
    elapsedMs < durationMs;

  return (
    <div className="px-3.5 py-2.5 rounded-lg border border-[#D4AF63]/30 bg-[#12151E] flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          title="Play / Pause Auto-Scroll (P)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF63] hover:bg-[#E2BF76] text-[#0A0B0E] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Pause Scroll
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              {elapsedMs >= durationMs ? 'Replay Scroll' : 'Play Scroll'}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onRestart}
          title="Restart lyrics from top"
          className="p-1.5 rounded-md bg-[#191D29] hover:bg-[#222738] border border-white/10 text-[#CBD5E1] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-w-[160px] flex items-center gap-2.5">
        <span className="text-[11px] font-mono text-[#FAF8F4] tabular-nums shrink-0">
          {formatClock(elapsedMs / 1000)}
        </span>
        <input
          type="range"
          min={0}
          max={durationMs}
          step={250}
          value={elapsedMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Scrub lyric scroll position"
          className="w-full accent-[#D4AF63] cursor-pointer h-1.5 bg-white/10 rounded-lg"
        />
        <span className="text-[11px] font-mono text-[#94A3B8] tabular-nums shrink-0">
          {formatClock(durationSec)}
        </span>
      </div>

      <span className="text-[11px] font-mono text-[#E3C17A] tabular-nums whitespace-nowrap shrink-0">
        {metrics.pxPerSec.toFixed(1)} px/s
      </span>
    </div>
  );
}
