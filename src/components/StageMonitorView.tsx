import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  applySlidePatchToScenes,
  createSenderId,
  SyncMessage,
} from '../lib/liveSyncChannel';
import {
  AutoScrollPlaybackState,
  LivePresentationState,
  ServiceScene,
  ServiceSettings,
  SlideData,
} from '../types/presentation';
import {
  formatCountdown,
  formatServiceClock,
  getRemainingMs,
} from './ServiceTimerWidget';

interface StageMonitorViewProps {
  initialState: LivePresentationState;
  storageKey: string;
  channelName: string;
}

function resolveStageTokens(
  text: string | undefined,
  settings: ServiceSettings
): string {
  if (!text) return '';
  return text
    .replace(/\[CHURCH NAME\]/g, settings.churchName || '[CHURCH NAME]')
    .replace(/\[DATE\]/g, settings.serviceDate || '[DATE]')
    .replace(
      /\[THEME \/ SCRIPTURE\]/g,
      settings.themeScripture || '[THEME / SCRIPTURE]'
    )
    .replace(
      /\[NEXT SERVICE DATE\]/g,
      settings.nextServiceDate || '[NEXT SERVICE DATE]'
    )
    .replace(
      /\[SOCIAL MEDIA \/ CONTACT\]/g,
      settings.socialContact || '[SOCIAL MEDIA / CONTACT]'
    );
}

function parseStageLine(rawLine: string): {
  tagOnly?: string;
  inlineTag?: string;
  lyricText: string;
} {
  const trimmed = rawLine.trim();
  const standaloneMatch = trimmed.match(/^\[([A-Za-z0-9\s\-–—·#&/]+)\]$/);
  if (standaloneMatch) {
    return { tagOnly: standaloneMatch[1].trim(), lyricText: '' };
  }
  const inlineMatch = trimmed.match(/^\[([A-Za-z0-9\s\-–—·#&/]+)\]\s+(.+)$/);
  if (inlineMatch) {
    return {
      inlineTag: inlineMatch[1].trim(),
      lyricText: inlineMatch[2],
    };
  }
  return { lyricText: rawLine };
}

function getNextCue(
  scenes: ServiceScene[],
  activeSceneId: string,
  activeSlideId: string
): { scene: ServiceScene; slide: SlideData } | null {
  const sceneIdx = scenes.findIndex((s) => s.id === activeSceneId);
  if (sceneIdx === -1) return null;
  const currentScene = scenes[sceneIdx];
  const slideIdx = currentScene.slides.findIndex((sl) => sl.id === activeSlideId);

  if (slideIdx >= 0 && slideIdx + 1 < currentScene.slides.length) {
    return {
      scene: currentScene,
      slide: currentScene.slides[slideIdx + 1],
    };
  }

  if (sceneIdx + 1 < scenes.length) {
    const nextScene = scenes[sceneIdx + 1];
    if (nextScene.slides.length > 0) {
      return {
        scene: nextScene,
        slide: nextScene.slides[0],
      };
    }
  }

  return null;
}

export const StageMonitorView: React.FC<StageMonitorViewProps> = ({
  initialState,
  storageKey,
  channelName,
}) => {
  const [state, setState] = useState<LivePresentationState>(initialState);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const senderId = useMemo(() => createSenderId(), []);

  // Clock & 30s cue countdown tick (250ms for smooth countdown updates)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Real-time BroadcastChannel + storage sync listener
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
              role: 'stage-monitor',
            } satisfies SyncMessage);
            break;
        }
      };

      channel.postMessage({
        type: 'PRESENCE_PONG',
        senderId,
        role: 'stage-monitor',
      } satisfies SyncMessage);
      channel.postMessage({
        type: 'REQUEST_SYNC',
        senderId,
        role: 'stage-monitor',
      } satisfies SyncMessage);
    }

    const handleBeforeUnload = () => {
      channel?.postMessage({
        type: 'PRESENCE_LEAVE',
        senderId,
        role: 'stage-monitor',
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

  // Auto-hide cursor on stage display
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

  const activeScene =
    state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0];
  const activeSlideIndex = Math.max(
    0,
    activeScene.slides.findIndex((sl) => sl.id === state.activeSlideId)
  );
  const activeSlide =
    activeScene.slides[activeSlideIndex] || activeScene.slides[0];
  const openingSlide = state.scenes[0]?.slides[0];

  const displayedActiveSlide =
    state.override === 'hold-opening' && openingSlide
      ? openingSlide
      : activeSlide;

  const nextCue = useMemo(
    () => getNextCue(state.scenes, activeScene.id, activeSlide.id),
    [state.scenes, activeScene.id, activeSlide.id]
  );

  const nextScene = useMemo(() => {
    const idx = state.scenes.findIndex((s) => s.id === activeScene.id);
    if (idx >= 0 && idx + 1 < state.scenes.length) {
      return state.scenes[idx + 1];
    }
    return null;
  }, [state.scenes, activeScene.id]);

  const timer = state.serviceTimer;
  const remainingMs = timer ? getRemainingMs(timer, nowMs) : null;
  const isCountdownActive = Boolean(
    timer &&
      ((timer.mode === 'duration' && timer.countdownTargetMs !== null) ||
        (timer.mode === 'clock-target' && timer.targetTimeStr))
  );

  const upcomingCueToast = useMemo(() => {
    if (!nextScene) return null;

    const candidateRemainingMs: number[] = [];

    if (
      activeSlide.layout === 'lyric' &&
      activeSlide.autoScrollEnabled &&
      state.autoScrollPlayback?.slideId === activeSlide.id &&
      state.autoScrollPlayback.isPlaying
    ) {
      const durationMs =
        Math.max(10, activeSlide.autoScrollDurationSec ?? 180) * 1000;
      const elapsedMs =
        state.autoScrollPlayback.pausedElapsedMs +
        (state.autoScrollPlayback.startedAt !== null
          ? Math.max(0, nowMs - state.autoScrollPlayback.startedAt)
          : 0);
      const songRemainingMs = Math.max(0, durationMs - elapsedMs);
      if (songRemainingMs > 0 && songRemainingMs <= 30_000) {
        candidateRemainingMs.push(songRemainingMs);
      }
    }

    if (remainingMs !== null && remainingMs > 0 && remainingMs <= 30_000) {
      candidateRemainingMs.push(remainingMs);
    }

    if (candidateRemainingMs.length === 0) return null;

    const cueRemainingMs = Math.min(...candidateRemainingMs);
    const firstSlide = nextScene.slides[0];
    const isSongScene =
      firstSlide?.layout === 'song-title' ||
      firstSlide?.layout === 'lyric' ||
      nextScene.category === 'Praise & Worship';
    const isTransitionScene =
      firstSlide?.layout === 'section-transition' ||
      nextScene.category === 'Section Transition';

    const cueKindLabel = isSongScene
      ? 'Next Song'
      : isTransitionScene
        ? 'Section Transition'
        : nextScene.category;

    const cueTitle = firstSlide
      ? resolveStageTokens(firstSlide.title, state.settings)
      : nextScene.name;

    const cueDetail = firstSlide
      ? resolveStageTokens(
          firstSlide.subtitle || firstSlide.metaPrimary,
          state.settings
        )
      : '';

    return {
      sceneCode: nextScene.code,
      sceneName: nextScene.name,
      cueKindLabel,
      cueTitle: cueTitle || nextScene.name,
      cueDetail,
      remainingMs: cueRemainingMs,
      secondsLeft: Math.max(1, Math.ceil(cueRemainingMs / 1000)),
    };
  }, [
    nextScene,
    activeSlide,
    state.autoScrollPlayback,
    state.settings,
    remainingMs,
    nowMs,
  ]);

  const handleStageClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      onClick={handleStageClick}
      className={`fixed inset-0 w-screen h-screen bg-[#050608] text-[#FAF8F4] flex flex-col select-none overflow-hidden ${
        cursorHidden ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* Top Stage Telemetry Header */}
      <header className="shrink-0 h-16 px-8 border-b border-white/[0.1] bg-[#080A0F] flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#D4AF63] font-semibold shrink-0">
            Stage Monitor
          </span>
          <span className="text-white/20" aria-hidden="true">
            ·
          </span>
          <span className="text-sm font-semibold text-[#FAF8F4] truncate">
            {activeScene.code} · {activeScene.name}
          </span>
          <span className="text-white/20" aria-hidden="true">
            /
          </span>
          <span className="text-sm text-[#94A3B8] truncate">
            {activeSlide.label}
          </span>
          <span className="text-xs font-mono text-[#64748B] tabular-nums shrink-0 ml-1">
            ({activeSlideIndex + 1}/{activeScene.slides.length})
          </span>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {state.override !== 'live' && (
            <span
              className={`text-xs font-mono font-semibold uppercase tracking-wider ${
                state.override === 'blackout'
                  ? 'text-red-400'
                  : 'text-amber-300'
              }`}
            >
              TV:{' '}
              {state.override === 'clear-text'
                ? 'Clear Text'
                : state.override === 'hold-opening'
                  ? 'Holding Opening'
                  : 'Blackout'}
            </span>
          )}

          {isCountdownActive && remainingMs !== null && (
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
                {timer?.countdownLabel || 'Timer'}
              </span>
              <span className="text-xl font-semibold text-[#E3C17A]">
                {remainingMs === 0 ? '00:00' : formatCountdown(remainingMs)}
              </span>
            </div>
          )}

          <span className="text-xl font-mono font-semibold text-[#FAF8F4] tabular-nums">
            {formatServiceClock(nowMs)}
          </span>
        </div>
      </header>

      {/* Upcoming Cue Notification Toast (Pulses gently 30s before next song or transition) */}
      <AnimatePresence>
        {upcomingCueToast && (
          <motion.aside
            key={`${upcomingCueToast.sceneCode}-${upcomingCueToast.cueTitle}`}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{
              opacity: [0.9, 1, 0.9],
              y: 0,
              scale: 1,
              boxShadow: [
                '0 16px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,99,0.35)',
                '0 18px 46px rgba(0,0,0,0.72), 0 0 26px rgba(212,175,99,0.28)',
                '0 16px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,99,0.35)',
              ],
            }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{
              opacity: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
              boxShadow: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
              y: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            }}
            className="pointer-events-none fixed top-20 right-8 z-30 w-[390px] max-w-[calc(100vw-4rem)] rounded-xl border border-[#D4AF63]/65 bg-[#0C0F17]/95 backdrop-blur-md overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[#E3C17A]">
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em]">
                    Upcoming Cue
                  </span>
                </div>
                <span className="text-base font-mono font-bold text-[#FAF8F4] tabular-nums">
                  {String(upcomingCueToast.secondsLeft).padStart(2, '0')}s
                </span>
              </div>

              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#FAF8F4] truncate">
                  {upcomingCueToast.sceneCode} · {upcomingCueToast.cueTitle}
                </p>
                <p className="text-xs text-[#94A3B8] truncate">
                  {upcomingCueToast.cueKindLabel}
                  {upcomingCueToast.cueDetail
                    ? ` · ${upcomingCueToast.cueDetail}`
                    : upcomingCueToast.sceneName !== upcomingCueToast.cueTitle
                      ? ` · ${upcomingCueToast.sceneName}`
                      : ''}
                </p>
              </div>
            </div>

            <div className="h-0.5 w-full bg-white/[0.08]">
              <div
                className="h-full bg-[#D4AF63] transition-[width] duration-200 ease-linear"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (upcomingCueToast.remainingMs / 30_000) * 100)
                  )}%`,
                }}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Current Active Content (High-Contrast Stage Readout) */}
      <section className="flex-1 min-h-0 px-10 py-6 flex flex-col justify-center overflow-hidden">
        <div
          className={`w-full max-w-[1440px] mx-auto transition-opacity duration-300 ${
            state.override === 'blackout' ? 'opacity-45' : 'opacity-100'
          }`}
        >
          <StageCurrentContent
            slide={displayedActiveSlide}
            settings={state.settings}
            playback={state.autoScrollPlayback}
          />
        </div>
      </section>

      {/* Bottom Upcoming Lines ("Up Next" Confidence Strip) */}
      <section className="shrink-0 h-[31vh] min-h-[190px] max-h-[300px] px-10 py-5 border-t border-white/[0.12] bg-[#080A0F] flex flex-col justify-center overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto flex flex-col h-full justify-center">
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono font-semibold uppercase tracking-[0.24em] text-[#D4AF63] shrink-0">
                Up Next
              </span>
              {nextCue ? (
                <span className="text-sm font-medium text-[#CBD5E1] truncate">
                  {nextCue.scene.code} · {nextCue.scene.name} —{' '}
                  {nextCue.slide.label}
                </span>
              ) : (
                <span className="text-sm text-[#64748B]">
                  End of Service Rundown
                </span>
              )}
            </div>
            {displayedActiveSlide.operatorNote && (
              <span className="text-xs text-amber-200/80 truncate max-w-[45%]">
                Note: {displayedActiveSlide.operatorNote}
              </span>
            )}
          </div>

          {nextCue ? (
            <StageNextPreview
              slide={nextCue.slide}
              settings={state.settings}
            />
          ) : (
            <p className="text-2xl font-sans text-[#475569]">
              No further cues queued in rundown.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

const StageCurrentContent: React.FC<{
  slide: SlideData;
  settings: ServiceSettings;
  playback?: AutoScrollPlaybackState;
}> = ({ slide, settings, playback }) => {
  if (slide.layout === 'lyric' && slide.autoScrollEnabled) {
    return <StageAutoScrollLyrics slide={slide} playback={playback} />;
  }

  const lines = slide.lines || [];
  const title = resolveStageTokens(slide.title, settings);
  const subtitle = resolveStageTokens(slide.subtitle, settings);
  const body = resolveStageTokens(slide.body, settings);
  const kicker = resolveStageTokens(slide.kicker, settings);

  // Lyric, Call to Worship, Responsive Reading, Doxology
  if (
    slide.layout === 'lyric' ||
    slide.layout === 'call-to-worship' ||
    slide.layout === 'responsive-reading' ||
    slide.layout === 'doxology'
  ) {
    const hasEmbeddedTag = lines.some((l) => Boolean(parseStageLine(l).tagOnly || parseStageLine(l).inlineTag));
    const displayKicker =
      !hasEmbeddedTag && kicker ? kicker : slide.layout === 'lyric' ? undefined : kicker;

    return (
      <div className="space-y-3 text-center">
        {(displayKicker || (slide.layout === 'lyric' && title)) && (
          <div className="flex items-center justify-center gap-3 text-sm font-mono uppercase tracking-[0.22em] text-[#E3C17A]">
            {displayKicker && <span>{displayKicker}</span>}
            {displayKicker && slide.layout === 'lyric' && title && (
              <span className="text-white/25" aria-hidden="true">
                ·
              </span>
            )}
            {slide.layout === 'lyric' && title && (
              <span className="text-[#94A3B8]">{title}</span>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          {lines.map((rawLine, idx) => {
            const parsed = parseStageLine(rawLine);
            if (parsed.tagOnly) {
              return (
                <p
                  key={idx}
                  className="text-sm font-mono font-semibold uppercase tracking-[0.24em] text-[#E3C17A] pb-1"
                >
                  [{parsed.tagOnly}]
                </p>
              );
            }

            const isLeader =
              slide.layout === 'responsive-reading' &&
              /^(Leader|Pastor|Reader)\s*:/i.test(parsed.lyricText);
            const isCongregation =
              slide.layout === 'responsive-reading' &&
              /^(Congregation|People|All)\s*:/i.test(parsed.lyricText);

            return (
              <React.Fragment key={idx}>
                {parsed.inlineTag && (
                  <p className="text-sm font-mono font-semibold uppercase tracking-[0.24em] text-[#E3C17A]">
                    [{parsed.inlineTag}]
                  </p>
                )}
                <p
                  className={`font-sans font-bold leading-[1.22] tracking-[-0.01em] ${
                    lines.length >= 5
                      ? 'text-[clamp(1.75rem,3.1vw,2.85rem)]'
                      : 'text-[clamp(2.1rem,4vw,3.75rem)]'
                  } ${
                    isLeader
                      ? 'text-[#E3C17A]'
                      : isCongregation
                        ? 'text-[#FFFFFF]'
                        : 'text-[#FFFFFF]'
                  }`}
                  style={{ textWrap: 'balance' }}
                >
                  {parsed.lyricText}
                </p>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Scripture / Sermon / Prayer / Community / Hold screens
  return (
    <div className="space-y-3 text-center max-w-[1160px] mx-auto">
      {kicker && (
        <p className="text-sm font-mono font-semibold uppercase tracking-[0.26em] text-[#E3C17A]">
          {kicker}
        </p>
      )}
      <h1
        className="font-sans font-bold text-[clamp(2rem,4.1vw,3.75rem)] leading-[1.15] text-[#FFFFFF]"
        style={{ textWrap: 'balance' }}
      >
        {title}
      </h1>
      {body && (
        <p
          className="font-sans font-medium text-[clamp(1.35rem,2.4vw,2.2rem)] leading-[1.35] text-[#E2E8F0] pt-1"
          style={{ textWrap: 'balance' }}
        >
          {body}
        </p>
      )}
      {!body && subtitle && (
        <p
          className="font-sans text-[clamp(1.25rem,2.1vw,1.9rem)] leading-[1.35] text-[#CBD5E1]"
          style={{ textWrap: 'balance' }}
        >
          {subtitle}
        </p>
      )}
      {slide.metaPrimary && (
        <p className="text-base font-mono text-[#E3C17A] pt-1">
          {resolveStageTokens(slide.metaPrimary, settings)}
        </p>
      )}
    </div>
  );
};

const StageAutoScrollLyrics: React.FC<{
  slide: SlideData;
  playback?: AutoScrollPlaybackState;
}> = ({ slide, playback }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);
  const [translateY, setTranslateY] = useState(80);

  const lines = slide.lines || [];
  const durationSec = Math.max(10, slide.autoScrollDurationSec ?? 180);

  useEffect(() => {
    const listEl = listRef.current;
    const viewEl = containerRef.current;
    if (!listEl || !viewEl) return;

    const measure = () => {
      setContentHeight(listEl.scrollHeight);
      setViewportHeight(viewEl.clientHeight || 420);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(listEl);
    observer.observe(viewEl);
    return () => observer.disconnect();
  }, [lines]);

  const startY = Math.round(viewportHeight * 0.25);
  const endY = Math.min(
    startY,
    -(Math.max(0, contentHeight - Math.round(viewportHeight * 0.65)))
  );
  const travelPx = Math.max(0, startY - endY);

  useEffect(() => {
    if (!playback || playback.slideId !== slide.id) {
      setTranslateY(startY);
      return;
    }

    let rafId = 0;
    const updatePosition = () => {
      const elapsedMs =
        playback.isPlaying && playback.startedAt !== null
          ? playback.pausedElapsedMs + (Date.now() - playback.startedAt)
          : playback.pausedElapsedMs;
      const progress = Math.min(
        1,
        Math.max(0, elapsedMs / (durationSec * 1000))
      );
      setTranslateY(startY - travelPx * progress);

      if (playback.isPlaying && progress < 1) {
        rafId = window.requestAnimationFrame(updatePosition);
      }
    };

    updatePosition();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [playback, slide.id, durationSec, startY, travelPx]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-[0.22em] text-[#E3C17A] mb-2">
        <span>Auto-Scroll Teleprompter</span>
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <span className="text-[#94A3B8]">{slide.title}</span>
      </div>
      <div
        ref={containerRef}
        className="relative w-full h-[46vh] min-h-[260px] overflow-hidden flex flex-col items-center"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 14%, black 84%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 14%, black 84%, transparent 100%)',
        }}
      >
        <div
          ref={listRef}
          style={{
            transform: `translate3d(0, ${translateY}px, 0)`,
            willChange: 'transform',
          }}
          className="w-full flex flex-col items-center text-center"
        >
          {lines.map((line, i) => {
            if (line.trim() === '') {
              return <div key={i} className="h-6" aria-hidden="true" />;
            }
            const parsed = parseStageLine(line);
            if (parsed.tagOnly) {
              return (
                <p
                  key={i}
                  className="text-sm font-mono font-semibold uppercase tracking-[0.24em] text-[#E3C17A] mt-3 mb-1"
                >
                  [{parsed.tagOnly}]
                </p>
              );
            }
            return (
              <React.Fragment key={i}>
                {parsed.inlineTag && (
                  <p className="text-sm font-mono font-semibold uppercase tracking-[0.24em] text-[#E3C17A] mt-2 mb-1">
                    [{parsed.inlineTag}]
                  </p>
                )}
                <p className="font-sans font-bold text-[clamp(1.65rem,3vw,2.75rem)] leading-[1.34] text-[#FFFFFF] my-0.5">
                  {parsed.lyricText}
                </p>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StageNextPreview: React.FC<{
  slide: SlideData;
  settings: ServiceSettings;
}> = ({ slide, settings }) => {
  const lines = slide.lines || [];
  if (lines.length > 0) {
    const previewLines = lines
      .filter((l) => l.trim() !== '')
      .slice(0, 4);

    return (
      <div className="space-y-1 text-left sm:text-center">
        {previewLines.map((rawLine, idx) => {
          const parsed = parseStageLine(rawLine);
          if (parsed.tagOnly) {
            return (
              <p
                key={idx}
                className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-[#D4AF63]/85"
              >
                [{parsed.tagOnly}]
              </p>
            );
          }
          return (
            <p
              key={idx}
              className="font-sans font-semibold text-[clamp(1.1rem,1.9vw,1.65rem)] leading-[1.28] text-[#94A3B8] truncate"
            >
              {parsed.inlineTag ? `[${parsed.inlineTag}] ` : ''}
              {parsed.lyricText}
            </p>
          );
        })}
      </div>
    );
  }

  const title = resolveStageTokens(slide.title, settings);
  const secondary = resolveStageTokens(slide.body || slide.subtitle, settings);

  return (
    <div className="space-y-1 text-left sm:text-center">
      <p className="font-sans font-semibold text-[clamp(1.2rem,2vw,1.75rem)] leading-[1.25] text-[#CBD5E1] truncate">
        {title}
      </p>
      {secondary && (
        <p className="font-sans text-[clamp(1rem,1.5vw,1.35rem)] text-[#94A3B8] line-clamp-2">
          {secondary}
        </p>
      )}
    </div>
  );
};
