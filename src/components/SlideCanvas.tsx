import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AutoScrollPlaybackState,
  OutputOverride,
  ServiceSettings,
  ServiceTimerState,
  SlideData,
  SlideTransitionType,
} from '../types/presentation';
import { AtmosphericLoopRenderer } from './AtmosphericBackgroundLibrary';
import { QrCodeMatrix } from './QrCodeMatrix';
import {
  formatCountdown,
  formatServiceClock,
  getRemainingMs,
} from './ServiceTimerWidget';

interface SlideCanvasProps {
  slide: SlideData;
  openingSlide?: SlideData;
  settings: ServiceSettings;
  override?: OutputOverride;
  showSafeGuides?: boolean;
  isOutputDisplay?: boolean;
  autoScrollPlayback?: AutoScrollPlaybackState;
  serviceTimer?: ServiceTimerState;
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 4.7 + 7) % 94}%`,
  top: `${(i * 11.3 + 12) % 86}%`,
  size: i % 3 === 0 ? 5 : i % 2 === 0 ? 3.5 : 2.5,
  duration: `${12 + (i % 7) * 2.5}s`,
  delay: `${-(i * 1.4)}s`,
}));

function resolveTokens(text: string | undefined, settings: ServiceSettings): string {
  if (!text) return '';
  return text
    .replace(/\[CHURCH NAME\]/g, settings.churchName || '[CHURCH NAME]')
    .replace(/\[DATE\]/g, settings.serviceDate || '[DATE]')
    .replace(/\[THEME \/ SCRIPTURE\]/g, settings.themeScripture || '[THEME / SCRIPTURE]')
    .replace(/\[NEXT SERVICE DATE\]/g, settings.nextServiceDate || '[NEXT SERVICE DATE]')
    .replace(/\[SOCIAL MEDIA \/ CONTACT\]/g, settings.socialContact || '[SOCIAL MEDIA / CONTACT]');
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  openingSlide,
  settings,
  override = 'live',
  showSafeGuides = false,
  isOutputDisplay = false,
  autoScrollPlayback,
  serviceTimer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nextScale = Math.min(rect.width / 1920, rect.height / 1080);
        setScale(nextScale);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const activeSlide =
    override === 'hold-opening' && openingSlide ? openingSlide : slide;

  const isBlackout = override === 'blackout';
  const isClearText = override === 'clear-text';

  const bgSrc = activeSlide.backgroundImage;
  const hasValidBg = Boolean(bgSrc && !failedImages[bgSrc]);

  const intensity = activeSlide.ambientIntensity ?? 'subtle';

  const transitionDuration = useMemo(() => {
    if (typeof activeSlide.transitionDurationSec === 'number') {
      return Math.max(0.2, Math.min(3.5, activeSlide.transitionDurationSec));
    }
    return getDefaultTransitionDuration(activeSlide.layout);
  }, [activeSlide.transitionDurationSec, activeSlide.layout]);

  const transitionType = useMemo<SlideTransitionType>(() => {
    if (activeSlide.transitionType) {
      return activeSlide.transitionType;
    }
    return getDefaultTransitionType(activeSlide.layout);
  }, [activeSlide.transitionType, activeSlide.layout]);

  const slideMotionProps = useMemo(() => {
    if (transitionType === 'slide') {
      return {
        initial: { opacity: 0, x: 96, y: 0, scale: 1 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0, x: -96, y: 0, scale: 1 },
      };
    }
    if (transitionType === 'dissolve') {
      return {
        initial: { opacity: 0, x: 0, y: 18, scale: 0.985 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0, x: 0, y: -12, scale: 1.01 },
      };
    }
    // 'fade' — crisp opacity crossfade
    return {
      initial: { opacity: 0, x: 0, y: 0, scale: 1 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      exit: { opacity: 0, x: 0, y: 0, scale: 1 },
    };
  }, [transitionType]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black select-none flex items-center justify-center"
    >
      {/* Scaled 1920x1080 Projection Stage */}
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className="relative shrink-0 overflow-hidden bg-[#07080B] text-[#FAF8F4]"
      >
        {/* Background Layer (Always present unless Blackout) */}
        <motion.div
          animate={{ opacity: isBlackout ? 0 : 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {/* Base Obsidian Atmospheric Gradient */}
          <div
            className="absolute inset-0"
            style={{
              background:
                activeSlide.layout === 'section-transition' && activeSlide.kicker === 'PART 02'
                  ? 'radial-gradient(ellipse 85% 75% at 50% 28%, rgba(212,175,99,0.22) 0%, rgba(28,24,18,0.65) 48%, #06070A 100%)'
                  : activeSlide.layout === 'birthday-single' || activeSlide.layout === 'birthday-multi'
                    ? 'radial-gradient(ellipse 80% 70% at 50% 35%, rgba(218,176,94,0.18) 0%, rgba(18,16,14,0.85) 55%, #07080B 100%)'
                    : 'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(196,158,86,0.12) 0%, rgba(13,15,20,0.9) 55%, #06070A 100%)',
            }}
          />

          {/* Photography Backdrop with Slow Ken Burns & Measured Scrim */}
          <AnimatePresence mode="sync">
            {hasValidBg && bgSrc && (
              <motion.div
                key={bgSrc}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: Math.max(0.5, transitionDuration), ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <img
                  src={bgSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [bgSrc]: true }))
                  }
                  className="w-full h-full object-cover animate-ken-burns"
                  style={{
                    opacity:
                      activeSlide.layout === 'lyric'
                        ? 0.36
                        : activeSlide.layout === 'welcome' || activeSlide.layout === 'benediction'
                          ? 0.56
                          : 0.48,
                  }}
                />
                {/* Measured Scrim for 4.5:1+ TV Projection Contrast */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      activeSlide.layout === 'lyric'
                        ? 'radial-gradient(circle at 50% 50%, rgba(6,7,10,0.52) 0%, rgba(6,7,10,0.86) 80%)'
                        : 'linear-gradient(180deg, rgba(6,7,10,0.68) 0%, rgba(6,7,10,0.48) 48%, rgba(6,7,10,0.84) 100%)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Gentle Light Rays */}
          <div
            className="pointer-events-none absolute -top-[28%] left-[12%] w-[76%] h-[135%] animate-light-rays"
            style={{
              background:
                intensity === 'cinematic'
                  ? 'linear-gradient(180deg, rgba(246,222,166,0.22) 0%, rgba(212,175,99,0.06) 52%, transparent 88%)'
                  : intensity === 'warm'
                    ? 'linear-gradient(180deg, rgba(235,204,142,0.14) 0%, rgba(212,175,99,0.03) 50%, transparent 85%)'
                    : 'linear-gradient(180deg, rgba(235,212,165,0.08) 0%, transparent 72%)',
              filter: 'blur(42px)',
            }}
          />

          {/* Subtle Ambient Glow */}
          <div
            className="pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 w-[1100px] h-[540px] rounded-full animate-glow-breathe"
            style={{
              background:
                'radial-gradient(circle, rgba(226,188,116,0.13) 0%, rgba(212,175,99,0.03) 45%, transparent 75%)',
              filter: 'blur(36px)',
            }}
          />

          {/* Curated Atmospheric CSS Loop Layer (GPU-Composited) */}
          <AtmosphericLoopRenderer loopId={activeSlide.atmosphericLoop} />

          {/* Subtle Atmospheric Particles (Enhanced gently for Celebrations & Opening) */}
          {(intensity === 'cinematic' ||
            intensity === 'celebration' ||
            intensity === 'warm') && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {PARTICLES.slice(
                0,
                intensity === 'celebration' ? 22 : intensity === 'cinematic' ? 16 : 10
              ).map((p) => (
                <span
                  key={p.id}
                  className="absolute rounded-full animate-particle"
                  style={
                    {
                      left: p.left,
                      top: p.top,
                      width: p.size,
                      height: p.size,
                      background:
                        p.id % 3 === 0
                          ? 'rgba(255, 248, 232, 0.85)'
                          : 'rgba(222, 184, 108, 0.78)',
                      boxShadow: '0 0 12px rgba(222, 184, 108, 0.45)',
                      '--particle-duration': p.duration,
                      '--particle-delay': p.delay,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Foreground Typography Layer (8.5% Safe Area: 164px X, 88px Y) */}
        <motion.div
          animate={{ opacity: isBlackout || isClearText ? 0 : 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full h-full"
        >
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={`${activeSlide.id}-${activeSlide.layout}-${activeSlide.displayStyle || 'centered'}`}
              initial={slideMotionProps.initial}
              animate={slideMotionProps.animate}
              exit={slideMotionProps.exit}
              transition={{ duration: transitionDuration, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute inset-0 px-[164px] py-[88px] flex flex-col items-center text-center ${
                activeSlide.displayStyle === 'lower-third' &&
                !activeSlide.autoScrollEnabled &&
                ['lyric', 'scripture-reading', 'sermon-scripture', 'sermon-point'].includes(
                  activeSlide.layout
                )
                  ? 'justify-end pb-[96px]'
                  : 'justify-center'
              }`}
            >
              {renderSlideLayout(activeSlide, settings, autoScrollPlayback)}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Transparent Service Clock & Countdown TV Overlay (Strict 8.5% Safe Area) */}
        <AnimatePresence>
          {serviceTimer?.showOnTv && !isBlackout && (
            <TvTimerOverlay timer={serviceTimer} />
          )}
        </AnimatePresence>

        {/* Operator-Only Safe Area Guide (NEVER shown on Extended TV Output) */}
        {showSafeGuides && !isOutputDisplay && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div
              className="absolute border border-dashed border-amber-300/45"
              style={{ top: 88, bottom: 88, left: 164, right: 164 }}
            />
            <span
              className="absolute text-[18px] font-mono tracking-wider text-amber-200/70"
              style={{ top: 54, left: 164 }}
            >
              TV SAFE AREA (8.5% MARGIN · 1920 × 1080)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

function renderSlideLayout(
  slide: SlideData,
  settings: ServiceSettings,
  autoScrollPlayback?: AutoScrollPlaybackState
) {
  const title = resolveTokens(slide.title, settings);
  const subtitle = resolveTokens(slide.subtitle, settings);
  const kicker = resolveTokens(slide.kicker, settings);
  const body = resolveTokens(slide.body, settings);
  const metaPrimary = resolveTokens(slide.metaPrimary, settings);
  const metaSecondary = resolveTokens(slide.metaSecondary, settings);

  switch (slide.layout) {
    case 'opening':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1360px]">
          <div className="w-20 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-8" />
          <p className="text-[28px] font-sans font-medium tracking-[0.28em] uppercase text-[#E6C987] mb-7">
            {subtitle || settings.churchName}
          </p>
          <h1
            className="font-serif font-semibold text-[112px] leading-[1.02] tracking-[0.02em] text-[#FAF8F4] mb-10"
            style={{ textWrap: 'balance', textShadow: '0 8px 40px rgba(0,0,0,0.65)' }}
          >
            {title}
          </h1>
          <div className="w-40 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent mb-9" />
          <div className="flex flex-col items-center gap-3 text-[30px] font-sans text-[#E7E2D8]/90">
            {metaPrimary && <p className="font-medium tracking-wide">{metaPrimary}</p>}
            {metaSecondary && (
              <p className="font-serif italic text-[36px] text-[#E6C987]/95">
                {metaSecondary}
              </p>
            )}
          </div>
        </div>
      );

    case 'section-transition':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1320px]">
          {kicker && (
            <p className="text-[28px] font-mono font-medium tracking-[0.36em] uppercase text-[#E2BF76] mb-6">
              {kicker}
            </p>
          )}
          <div className="w-28 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-8" />
          <h1
            className="font-serif font-semibold text-[110px] leading-[1.06] tracking-[0.03em] text-[#FAF8F4] mb-8"
            style={{ textWrap: 'balance', textShadow: '0 8px 40px rgba(0,0,0,0.65)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="font-serif italic text-[46px] leading-[1.3] text-[#EBE4D6]/90 max-w-[1050px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'prayer':
    case 'invocation':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1220px]">
          <div className="w-16 h-[1px] bg-[#D4AF63]/80 mb-10" />
          <h1 className="font-serif font-semibold text-[116px] leading-[1.05] tracking-[0.06em] text-[#FAF8F4] mb-9">
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-serif italic text-[48px] leading-[1.35] text-[#E7DFD0]/92 max-w-[1020px]"
              style={{ textWrap: 'balance' }}
            >
              {subtitle}
            </p>
          )}
          <div className="w-16 h-[1px] bg-[#D4AF63]/80 mt-10" />
        </div>
      );

    case 'preliminaries':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1280px]">
          {kicker && (
            <p className="text-[26px] font-sans font-medium tracking-[0.28em] uppercase text-[#DFBC73] mb-6">
              {kicker}
            </p>
          )}
          <h1
            className="font-serif font-semibold text-[96px] leading-[1.08] tracking-[0.02em] text-[#FAF8F4] mb-7"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="font-sans text-[38px] leading-[1.4] text-[#E9E4DA]/90 max-w-[1050px]">
              {subtitle}
            </p>
          )}
          {body && (
            <p className="mt-8 font-sans text-[28px] leading-[1.5] text-[#C8C2B6]/80 max-w-[920px]">
              {body}
            </p>
          )}
        </div>
      );

    case 'birthday-single':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1300px]">
          <p className="text-[30px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E6C680] mb-6">
            {kicker || 'BIRTHDAYS'}
          </p>
          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-9" />
          <h1
            className="font-serif font-semibold text-[118px] leading-[1.05] text-[#FAF8F4] mb-6"
            style={{ textWrap: 'balance', textShadow: '0 8px 36px rgba(0,0,0,0.55)' }}
          >
            {title}
          </h1>
          {metaPrimary && (
            <p className="text-[38px] font-sans font-medium tracking-[0.14em] uppercase text-[#E8D2A0] mb-9">
              {metaPrimary}
            </p>
          )}
          {subtitle && (
            <p className="font-serif italic text-[42px] leading-[1.35] text-[#EBE4D6]/90 max-w-[980px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'birthday-multi':
      return (
        <div className="flex flex-col items-center justify-center w-full max-w-[1380px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E6C680] mb-4">
            {kicker || 'BIRTHDAYS'}
          </p>
          <h1 className="font-serif font-semibold text-[76px] leading-[1.1] text-[#FAF8F4] mb-4">
            {title}
          </h1>
          {subtitle && (
            <p className="font-serif italic text-[36px] text-[#E4DCCD]/88 mb-12">
              {subtitle}
            </p>
          )}
          <div className="grid grid-cols-3 gap-8 w-full">
            {(slide.peopleList || []).map((person, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-center px-8 py-12 rounded-2xl border border-[#D4AF63]/30 bg-white/[0.04] backdrop-blur-sm"
              >
                <span className="font-mono text-[22px] tracking-[0.2em] text-[#D4AF63] mb-4">
                  0{idx + 1}
                </span>
                <p className="font-serif font-semibold text-[48px] leading-[1.15] text-[#FAF8F4] mb-3">
                  {resolveTokens(person.name, settings)}
                </p>
                <p className="font-sans text-[28px] text-[#E3D8C1]/85">
                  {resolveTokens(person.date, settings)}
                </p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'anniversary':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1300px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E6C680] mb-6">
            {kicker || 'WEDDING ANNIVERSARY'}
          </p>
          <div className="w-28 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-8" />
          <h1
            className="font-serif font-semibold text-[108px] leading-[1.06] text-[#FAF8F4] mb-6"
            style={{ textWrap: 'balance', textShadow: '0 8px 36px rgba(0,0,0,0.7)' }}
          >
            {title}
          </h1>
          {metaPrimary && (
            <p className="text-[44px] font-sans font-semibold tracking-[0.2em] uppercase text-[#E6C680] mb-9">
              {metaPrimary}
            </p>
          )}
          {subtitle && (
            <p className="font-serif italic text-[40px] leading-[1.35] text-[#F1ECE2]/92 max-w-[980px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'welcome':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1340px]">
          {kicker && (
            <p className="text-[28px] font-sans font-semibold tracking-[0.28em] uppercase text-[#EBD094] mb-7">
              {kicker}
            </p>
          )}
          <h1
            className="font-serif font-semibold text-[112px] leading-[1.04] tracking-[0.02em] text-[#FAF8F4] mb-8"
            style={{ textWrap: 'balance', textShadow: '0 10px 44px rgba(0,0,0,0.75)' }}
          >
            {title}
          </h1>
          <div className="w-32 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-8" />
          {subtitle && (
            <p className="font-serif italic text-[50px] leading-[1.3] text-[#FAF8F4]/95">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'announcement-title':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1260px]">
          {kicker && (
            <p className="text-[28px] font-sans font-medium tracking-[0.28em] uppercase text-[#E3C17A] mb-6">
              {kicker}
            </p>
          )}
          <h1 className="font-serif font-semibold text-[112px] leading-[1.06] tracking-[0.03em] text-[#FAF8F4] mb-7">
            {title}
          </h1>
          {subtitle && (
            <p className="font-sans text-[38px] leading-[1.4] text-[#EAE4D7]/88 max-w-[980px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'announcement-item':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1320px] w-full">
          {kicker && (
            <p className="text-[26px] font-mono font-medium tracking-[0.3em] uppercase text-[#E3C17A] mb-6">
              {kicker}
            </p>
          )}
          <h1
            className="font-serif font-semibold text-[94px] leading-[1.08] text-[#FAF8F4] mb-9"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[36px] font-sans font-semibold text-[#F1D598] mb-8">
            {metaPrimary && <span>{metaPrimary}</span>}
            {metaPrimary && metaSecondary && (
              <span className="text-white/35" aria-hidden="true">
                |
              </span>
            )}
            {metaSecondary && <span>{metaSecondary}</span>}
          </div>
          {body && (
            <p
              className="font-sans text-[34px] leading-[1.45] text-[#E6E0D5]/88 max-w-[1060px]"
              style={{ textWrap: 'balance' }}
            >
              {body}
            </p>
          )}
        </div>
      );

    case 'additional-program':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1300px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.3em] uppercase text-[#E3C17A] mb-5">
            {slide.variationTag
              ? `${kicker || 'ADDITIONAL PROGRAM'}  ·  ${slide.variationTag.toUpperCase()}`
              : kicker || 'ADDITIONAL PROGRAM'}
          </p>
          <div className="w-28 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-9" />
          <h1
            className="font-serif font-semibold text-[98px] leading-[1.07] text-[#FAF8F4] mb-8"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          {metaPrimary && (
            <p className="font-sans font-semibold text-[42px] tracking-[0.04em] text-[#EAD092] mb-7">
              {metaPrimary}
            </p>
          )}
          {subtitle && (
            <p
              className="font-serif italic text-[38px] leading-[1.4] text-[#EAE3D5]/88 max-w-[1020px]"
              style={{ textWrap: 'balance' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'call-to-worship':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1360px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-5">
            {kicker || 'CALL TO WORSHIP'}
          </p>
          <h2 className="font-serif font-semibold text-[54px] text-[#EED59D] mb-10">
            {title}
          </h2>
          <div className="flex flex-col items-center gap-4">
            {(slide.lines || []).map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.14, duration: 0.55 }}
                className="font-sans font-medium text-[46px] leading-[1.36] text-[#FAF8F4]"
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>
      );

    case 'song-title':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1340px]">
          {kicker && (
            <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-7">
              {kicker}
            </p>
          )}
          <h1
            className="font-serif font-semibold text-[104px] leading-[1.08] text-[#FAF8F4] mb-7"
            style={{ textWrap: 'balance', textShadow: '0 8px 36px rgba(0,0,0,0.7)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="font-sans text-[32px] tracking-[0.06em] text-[#E6DFD2]/85">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'lyric': {
      if (slide.autoScrollEnabled) {
        return (
          <AutoScrollLyricsBlock
            slide={slide}
            playback={autoScrollPlayback}
          />
        );
      }
      const isLowerThird = slide.displayStyle === 'lower-third';
      const isLargePrint = slide.textScale === 'large';
      const visibleLines = (slide.lines || []).slice(0, 5);
      if (isLowerThird) {
        return (
          <div className="w-full max-w-[1520px] px-12 py-9 rounded-2xl bg-black/55 backdrop-blur-md border border-[#D4AF63]/25 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-2.5">
              {visibleLines.map((rawLine, i) => {
                const parsed = parseLyricLineWithTag(rawLine);
                if (parsed.tagOnly) {
                  return (
                    <LyricSectionTag
                      key={i}
                      label={parsed.tagOnly}
                      compact={true}
                    />
                  );
                }
                return (
                  <React.Fragment key={i}>
                    {parsed.inlineTag && (
                      <LyricSectionTag label={parsed.inlineTag} compact={true} />
                    )}
                    <p
                      className={`font-sans font-bold leading-[1.22] tracking-[-0.01em] text-[#FFFFFF] ${
                        isLargePrint ? 'text-[56px]' : 'text-[48px]'
                      }`}
                      style={{
                        textShadow: '0 3px 18px rgba(0,0,0,0.9)',
                        textWrap: 'balance',
                      }}
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
      return (
        <div className="flex flex-col items-center justify-center w-full max-w-[1480px]">
          <div className="flex flex-col items-center justify-center gap-5">
            {visibleLines.map((rawLine, i) => {
              const parsed = parseLyricLineWithTag(rawLine);
              if (parsed.tagOnly) {
                return <LyricSectionTag key={i} label={parsed.tagOnly} />;
              }
              return (
                <React.Fragment key={i}>
                  {parsed.inlineTag && <LyricSectionTag label={parsed.inlineTag} />}
                  <p
                    className={`font-sans font-bold leading-[1.24] tracking-[-0.01em] text-[#FFFFFF] ${
                      isLargePrint ? 'text-[86px]' : 'text-[74px]'
                    }`}
                    style={{
                      textShadow: '0 4px 28px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.9)',
                      textWrap: 'balance',
                    }}
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

    case 'scripture-reading': {
      const isLowerThird = slide.displayStyle === 'lower-third';
      const isLargePrint = slide.textScale === 'large';
      if (isLowerThird) {
        return (
          <div className="w-full max-w-[1540px] px-12 py-8 rounded-2xl bg-black/60 backdrop-blur-md border border-[#D4AF63]/30 text-left shadow-2xl">
            <div className="flex items-baseline justify-between gap-6 mb-3">
              <p className="text-[32px] font-serif font-semibold text-[#EED59D]">
                {title}
              </p>
              {metaPrimary && (
                <p className="text-[20px] font-sans tracking-[0.16em] uppercase text-[#C9C1B3]/80">
                  {metaPrimary}
                </p>
              )}
            </div>
            <p
              className={`font-sans font-medium leading-[1.35] text-[#FAF8F4] ${
                isLargePrint ? 'text-[40px]' : 'text-[35px]'
              }`}
              style={{ textWrap: 'balance' }}
            >
              {body}
            </p>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center max-w-[1380px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-5">
            {kicker || 'SCRIPTURE READING'}
          </p>
          <h1 className="font-serif font-semibold text-[68px] text-[#EED59D] mb-10">
            {title}
          </h1>
          <p
            className={`font-sans font-medium leading-[1.42] text-[#FAF8F4] max-w-[1320px] ${
              isLargePrint ? 'text-[58px]' : 'text-[50px]'
            }`}
            style={{ textWrap: 'balance' }}
          >
            {body}
          </p>
          {metaPrimary && (
            <p className="mt-10 text-[26px] font-sans tracking-[0.18em] uppercase text-[#C9C1B3]/75">
              {metaPrimary}
            </p>
          )}
        </div>
      );
    }

    case 'responsive-reading': {
      const isLargePrint = slide.textScale === 'large';
      return (
        <div className="flex flex-col items-center justify-center max-w-[1400px] w-full">
          <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-4">
            {kicker || 'RESPONSIVE READING'}
          </p>
          <h2 className="font-serif font-semibold text-[52px] text-[#EED59D] mb-9">
            {title}
          </h2>
          <div className="flex flex-col items-center gap-6 w-full">
            {(slide.lines || []).map((rawLine, i) => {
              const colonIdx = rawLine.indexOf(':');
              const hasRole = colonIdx > 0 && colonIdx < 18;
              const role = hasRole ? rawLine.slice(0, colonIdx).trim() : '';
              const text = hasRole ? rawLine.slice(colonIdx + 1).trim() : rawLine;
              const isCongregation =
                /congregation|all|people|response/i.test(role);

              return (
                <div key={i} className="flex flex-col items-center max-w-[1260px]">
                  {role && (
                    <span
                      className={`text-[20px] font-sans font-semibold tracking-[0.26em] uppercase mb-1.5 ${
                        isCongregation ? 'text-[#FAF8F4]/70' : 'text-[#E3C17A]'
                      }`}
                    >
                      {role}
                    </span>
                  )}
                  <p
                    className={`leading-[1.34] ${
                      isLargePrint ? 'text-[50px]' : 'text-[44px]'
                    } ${
                      isCongregation
                        ? 'font-sans font-bold text-[#FFFFFF]'
                        : 'font-serif italic text-[#F3DFA8]'
                    }`}
                    style={{
                      textWrap: 'balance',
                      textShadow: '0 4px 24px rgba(0,0,0,0.85)',
                    }}
                  >
                    {text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'communion':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1280px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-6">
            {kicker || 'THE LORD’S SUPPER'}
          </p>
          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-9" />
          <h1
            className="font-serif font-semibold text-[82px] leading-[1.12] text-[#FAF8F4] mb-8"
            style={{ textWrap: 'balance', textShadow: '0 8px 36px rgba(0,0,0,0.8)' }}
          >
            {title}
          </h1>
          {body && (
            <p
              className="font-serif italic text-[42px] leading-[1.38] text-[#EDE5D5]/92 max-w-[1080px] mb-8"
              style={{ textWrap: 'balance' }}
            >
              {body}
            </p>
          )}
          {metaPrimary && (
            <p className="text-[28px] font-sans font-semibold tracking-[0.2em] uppercase text-[#E6C987]">
              {metaPrimary}
            </p>
          )}
        </div>
      );

    case 'sermon-title':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1360px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-7">
            {kicker || "MESSAGE IN GOD'S WORD"}
          </p>
          <h1
            className="font-serif font-semibold text-[104px] leading-[1.06] text-[#FAF8F4] mb-10"
            style={{ textWrap: 'balance', textShadow: '0 8px 40px rgba(0,0,0,0.75)' }}
          >
            {title}
          </h1>
          <div className="w-32 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-9" />
          <div className="flex items-center gap-8 text-[34px] font-sans text-[#EDE6D8]/92">
            {metaPrimary && <span className="font-semibold">{metaPrimary}</span>}
            {metaPrimary && metaSecondary && (
              <span className="text-[#D4AF63]/60" aria-hidden="true">
                ·
              </span>
            )}
            {metaSecondary && <span className="text-[#E8C988]">{metaSecondary}</span>}
          </div>
        </div>
      );

    case 'sermon-point':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1320px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-3">
            {kicker || 'SERMON POINT'}
          </p>
          <span className="font-serif font-semibold text-[138px] leading-none text-[#D4AF63] mb-6 tabular-nums">
            {slide.pointNumber || '01'}
          </span>
          <h1
            className="font-sans font-bold text-[68px] leading-[1.2] text-[#FAF8F4] mb-7 max-w-[1220px]"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-serif italic text-[40px] leading-[1.38] text-[#DED7C8]/88 max-w-[1040px]"
              style={{ textWrap: 'balance' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'sermon-scripture':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1360px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-5">
            {kicker || 'KEY SCRIPTURE'}
          </p>
          <h2 className="font-serif font-semibold text-[58px] text-[#EED59D] mb-9">
            {title}
          </h2>
          <p
            className="font-serif italic text-[52px] leading-[1.38] text-[#FAF8F4] max-w-[1260px]"
            style={{ textWrap: 'balance' }}
          >
            {body}
          </p>
        </div>
      );

    case 'sermon-takeaway':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1320px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-8">
            {kicker || 'KEY TAKEAWAY'}
          </p>
          <div className="w-24 h-[1px] bg-[#D4AF63]/80 mb-10" />
          <h1
            className="font-serif font-semibold text-[76px] leading-[1.22] text-[#FAF8F4] max-w-[1240px]"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          <div className="w-24 h-[1px] bg-[#D4AF63]/80 mt-10" />
        </div>
      );

    case 'offering-title':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1280px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-7">
            {kicker || 'OFFERING'}
          </p>
          <h1
            className="font-serif font-semibold text-[96px] leading-[1.1] text-[#FAF8F4] mb-7"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>
          {metaPrimary && (
            <p className="text-[36px] font-sans font-semibold tracking-[0.12em] uppercase text-[#E8C988] mb-8">
              {metaPrimary}
            </p>
          )}
          {subtitle && (
            <p className="font-sans text-[34px] leading-[1.45] text-[#E5DFD3]/86 max-w-[1000px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'offering-ways':
      return (
        <div className="flex items-center justify-between gap-16 w-full max-w-[1440px] text-left">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#E3C17A] mb-4">
              {kicker || 'OFFERING'}
            </p>
            <h1 className="font-serif font-semibold text-[82px] leading-[1.06] text-[#FAF8F4] mb-10">
              {title}
            </h1>
            <div className="flex flex-col gap-6">
              {(slide.givingMethods || []).map((method, i) => (
                <div
                  key={i}
                  className="pb-5 border-b border-white/15 last:border-b-0"
                >
                  <p className="text-[24px] font-sans font-semibold tracking-[0.2em] uppercase text-[#E3C17A] mb-1.5">
                    {resolveTokens(method.label, settings)}
                  </p>
                  <p className="text-[34px] font-sans font-medium text-[#FAF8F4]">
                    {resolveTokens(method.detail, settings)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center px-10 py-10 rounded-3xl border border-[#D4AF63]/30 bg-white/[0.04]">
            <QrCodeMatrix value={slide.qrPayload || 'https://gracecovenant.org/give'} size={340} />
            <p className="mt-6 text-[26px] font-sans font-semibold tracking-[0.2em] uppercase text-[#EBD094]">
              SCAN TO GIVE
            </p>
          </div>
        </div>
      );

    case 'doxology':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1340px]">
          <p className="text-[28px] font-sans font-semibold tracking-[0.34em] uppercase text-[#E3C17A] mb-10">
            {kicker || 'DOXOLOGY'}
          </p>
          <div className="flex flex-col items-center gap-5">
            {(slide.lines || []).map((line, i) => (
              <p
                key={i}
                className="font-serif font-semibold text-[60px] leading-[1.3] text-[#FAF8F4]"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      );

    case 'benediction':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1320px]">
          <p className="text-[26px] font-sans font-semibold tracking-[0.32em] uppercase text-[#EBD094] mb-8">
            {kicker || 'CLOSING PRAYER & BENEDICTION'}
          </p>
          <h1
            className="font-serif font-semibold text-[98px] leading-[1.1] text-[#FAF8F4] mb-9"
            style={{ textWrap: 'balance', textShadow: '0 8px 36px rgba(0,0,0,0.75)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="font-sans text-[36px] leading-[1.4] text-[#F1ECE2]/92 max-w-[1060px]">
              {subtitle}
            </p>
          )}
        </div>
      );

    case 'final':
      return (
        <div className="flex flex-col items-center justify-center max-w-[1380px]">
          {kicker && (
            <p className="text-[28px] font-sans font-semibold tracking-[0.32em] uppercase text-[#EBD094] mb-7">
              {kicker}
            </p>
          )}
          <h1
            className="font-serif font-semibold text-[96px] leading-[1.06] text-[#FAF8F4] mb-8"
            style={{ textWrap: 'balance', textShadow: '0 8px 40px rgba(0,0,0,0.75)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="font-serif italic text-[42px] leading-[1.35] text-[#F2ECE0]/92 mb-12 max-w-[1040px]">
              {subtitle}
            </p>
          )}
          <div className="w-36 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent mb-8" />
          <div className="flex flex-col items-center gap-2 text-[30px] font-sans text-[#E7E0D4]/90">
            {metaPrimary && <p className="font-semibold">{metaPrimary}</p>}
            {metaSecondary && <p className="text-[#E6C987]">{metaSecondary}</p>}
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center justify-center">
          <h1 className="font-serif text-[88px] text-white">{title}</h1>
        </div>
      );
  }
}

export function getDefaultTransitionDuration(layout: SlideData['layout']): number {
  if (layout === 'section-transition' || layout === 'opening' || layout === 'final') {
    return 2.0;
  }
  if (layout === 'lyric' || layout === 'song-title') {
    return 0.5;
  }
  return 0.8;
}

export function getDefaultTransitionType(
  layout: SlideData['layout']
): SlideTransitionType {
  if (
    layout === 'section-transition' ||
    layout === 'opening' ||
    layout === 'final' ||
    layout === 'communion' ||
    layout === 'benediction'
  ) {
    return 'dissolve';
  }
  return 'fade';
}

function parseLyricLineWithTag(rawLine: string): {
  tagOnly?: string;
  inlineTag?: string;
  lyricText: string;
} {
  const trimmed = rawLine.trim();
  // Match standalone verse/section tags like [Verse 1], [Chorus], [Bridge], [Pre-Chorus], [Tag], [Outro]
  const standaloneMatch = trimmed.match(/^\[([A-Za-z0-9\s\-–—·#&/]+)\]$/);
  if (standaloneMatch) {
    return { tagOnly: standaloneMatch[1].trim(), lyricText: '' };
  }
  // Also support inline tag prefix like "[Chorus] Your name is the highest"
  const inlineMatch = trimmed.match(/^\[([A-Za-z0-9\s\-–—·#&/]+)\]\s+(.+)$/);
  if (inlineMatch) {
    return {
      inlineTag: inlineMatch[1].trim(),
      lyricText: inlineMatch[2],
    };
  }
  return { lyricText: rawLine };
}

const LyricSectionTag: React.FC<{ label: string; compact?: boolean }> = ({
  label,
  compact = false,
}) => (
  <div
    className={`inline-flex items-center justify-center border border-[#D4AF63]/55 bg-black/65 backdrop-blur-sm shadow-lg ${
      compact ? 'px-5 py-1.5 rounded-md mb-1' : 'px-7 py-2 rounded-lg my-2'
    }`}
  >
    <span
      className={`font-mono font-semibold uppercase tracking-[0.26em] text-[#F3DFA8] ${
        compact ? 'text-[20px]' : 'text-[26px]'
      }`}
    >
      {label}
    </span>
  </div>
);

export function estimateAutoScrollMetrics(slide: SlideData) {
  const lines = slide.lines || [];
  const durationSec = Math.max(10, slide.autoScrollDurationSec ?? 180);
  // Estimate virtual 1920x1080 content height based on 64px bold lines, section tags, and blank stanza gaps
  const estimatedHeight = lines.reduce((acc, line) => {
    if (line.trim() === '') return acc + 46;
    const parsed = parseLyricLineWithTag(line);
    if (parsed.tagOnly) return acc + 64;
    return acc + (parsed.inlineTag ? 150 : 94);
  }, 0);
  const startY = 240;
  const endY = Math.min(startY, -(Math.max(0, estimatedHeight - 540)));
  const travelPx = Math.max(0, startY - endY);
  const pxPerSec = travelPx / durationSec;
  const nonEmptyLines = lines.filter(
    (l) => l.trim() !== '' && !parseLyricLineWithTag(l).tagOnly
  ).length;
  const linesPerMin = nonEmptyLines > 0 ? (nonEmptyLines / durationSec) * 60 : 0;

  return {
    durationSec,
    estimatedHeight,
    travelPx,
    pxPerSec,
    linesPerMin,
  };
}

const AutoScrollLyricsBlock: React.FC<{
  slide: SlideData;
  playback?: AutoScrollPlaybackState;
}> = ({ slide, playback }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [translateY, setTranslateY] = useState(240);

  const lines = slide.lines || [];
  const durationSec = Math.max(10, slide.autoScrollDurationSec ?? 180);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      setContentHeight(el.scrollHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lines]);

  const startY = playback ? 240 : 120;
  const endY = Math.min(startY, -(Math.max(0, contentHeight - 540)));
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
      const progress = Math.min(1, Math.max(0, elapsedMs / (durationSec * 1000)));
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
    <div
      className="relative w-full max-w-[1480px] h-[820px] overflow-hidden flex flex-col items-center"
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
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
            return <div key={i} className="h-[46px]" aria-hidden="true" />;
          }
          const parsed = parseLyricLineWithTag(line);
          if (parsed.tagOnly) {
            return <LyricSectionTag key={i} label={parsed.tagOnly} />;
          }
          return (
            <React.Fragment key={i}>
              {parsed.inlineTag && <LyricSectionTag label={parsed.inlineTag} />}
              <p
                className="font-sans font-bold text-[64px] leading-[1.35] tracking-[-0.01em] text-[#FFFFFF] my-[5px]"
                style={{
                  textShadow:
                    '0 4px 28px rgba(0,0,0,0.88), 0 1px 4px rgba(0,0,0,0.92)',
                  textWrap: 'balance',
                }}
              >
                {parsed.lyricText}
              </p>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const TvTimerOverlay: React.FC<{ timer: ServiceTimerState }> = ({ timer }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = getRemainingMs(timer, nowMs);
  const isFinished = remainingMs === 0;

  const posClasses: Record<ServiceTimerState['tvPosition'], string> = {
    'top-right': 'top-[88px] right-[164px] items-end text-right',
    'top-left': 'top-[88px] left-[164px] items-start text-left',
    'bottom-right': 'bottom-[88px] right-[164px] items-end text-right',
    'bottom-center':
      'bottom-[88px] left-1/2 -translate-x-1/2 items-center text-center',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-none absolute z-20 flex flex-col px-9 py-5 rounded-2xl bg-black/40 backdrop-blur-md border border-[#D4AF63]/30 shadow-2xl ${posClasses[timer.tvPosition]}`}
    >
      <span className="text-[20px] font-sans font-semibold tracking-[0.26em] uppercase text-[#E6C987] mb-1">
        {timer.countdownLabel || 'SERVICE BEGINS IN'}
      </span>
      <div className="flex items-baseline gap-5">
        <span className="font-mono font-semibold text-[60px] leading-none text-[#FAF8F4] tabular-nums">
          {isFinished ? '00:00' : formatCountdown(remainingMs)}
        </span>
        {timer.showClockOnTv && (
          <>
            <span className="text-[32px] text-white/30" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-[28px] text-[#DED7C8]/85 tabular-nums whitespace-nowrap">
              {formatServiceClock(nowMs)}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
};

