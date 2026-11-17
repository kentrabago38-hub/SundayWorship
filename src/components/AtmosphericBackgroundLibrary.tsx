import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AtmosphericLoopId } from '../types/presentation';

export interface AtmosphericLoopMeta {
  id: AtmosphericLoopId;
  name: string;
  category: 'praise' | 'prayer' | 'all';
  mood: string;
  description: string;
}

export const ATMOSPHERIC_LOOPS: AtmosphericLoopMeta[] = [
  {
    id: 'none',
    name: 'Still Sanctuary',
    category: 'all',
    mood: 'Default',
    description: 'Clean static backdrop without extra loop motion.',
  },
  {
    id: 'golden-light',
    name: 'Golden Light',
    category: 'praise',
    mood: 'Opening · Praise',
    description: 'Sweeping warm cathedral sunbeams across deep obsidian.',
  },
  {
    id: 'slow-clouds',
    name: 'Slow Clouds',
    category: 'praise',
    mood: 'Worship · Benediction',
    description: 'Soft drifting twilight clouds with amber horizon glow.',
  },
  {
    id: 'dust-motes',
    name: 'Gentle Dust Motes',
    category: 'prayer',
    mood: 'Prayer · Communion',
    description: 'Floating golden light motes suspended in quiet air.',
  },
  {
    id: 'sanctuary-aurora',
    name: 'Sanctuary Aurora',
    category: 'praise',
    mood: 'Adoration · Transitions',
    description: 'Silky deep sapphire and gold ribbon waves.',
  },
  {
    id: 'ember-glow',
    name: 'Candlelight Embers',
    category: 'prayer',
    mood: 'Altar · Invocation',
    description: 'Warm rising embers and intimate vigil radiance.',
  },
  {
    id: 'starlight-mist',
    name: 'Midnight Stillness',
    category: 'prayer',
    mood: 'Scripture · Sermon',
    description: 'Calm nocturnal veil with subtle breathing mist.',
  },
  {
    id: 'morning-rays',
    name: 'Resurrection Dawn',
    category: 'praise',
    mood: 'Call to Worship',
    description: 'Luminous sunrise shafts warming the upper sanctuary.',
  },
];

const MOTES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${(i * 5.7 + 4) % 92}%`,
  top: `${(i * 11.1 + 10) % 86}%`,
  size: i % 3 === 0 ? 5 : i % 2 === 0 ? 3.5 : 2.5,
  duration: `${11 + (i % 6) * 2.5}s`,
  delay: `${-(i * 1.3)}s`,
}));

export const AtmosphericLoopRenderer: React.FC<{
  loopId?: AtmosphericLoopId;
  compact?: boolean;
}> = ({ loopId = 'none', compact = false }) => {
  if (!loopId || loopId === 'none') return null;

  const moteList = compact ? MOTES.slice(0, 7) : MOTES;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ contain: 'layout paint' }}
      aria-hidden="true"
    >
      {loopId === 'golden-light' && (
        <>
          <div
            className="absolute -top-[35%] left-[5%] w-[62%] h-[160%] animate-golden-sweep"
            style={{
              background:
                'linear-gradient(180deg, rgba(246,216,144,0.34) 0%, rgba(212,175,99,0.12) 48%, transparent 88%)',
              filter: compact ? 'blur(12px)' : 'blur(46px)',
            }}
          />
          <div
            className="absolute -top-[28%] right-[8%] w-[48%] h-[145%] animate-light-rays"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,240,196,0.22) 0%, rgba(212,175,99,0.06) 52%, transparent 85%)',
              filter: compact ? 'blur(10px)' : 'blur(42px)',
            }}
          />
        </>
      )}

      {loopId === 'slow-clouds' && (
        <>
          <div
            className="absolute -inset-x-[18%] top-[6%] h-[68%] rounded-full animate-cloud-a"
            style={{
              background:
                'radial-gradient(ellipse 65% 52% at 50% 50%, rgba(218,186,128,0.22) 0%, rgba(92,102,130,0.14) 48%, transparent 78%)',
              filter: compact ? 'blur(14px)' : 'blur(64px)',
            }}
          />
          <div
            className="absolute -inset-x-[15%] bottom-[-12%] h-[64%] rounded-full animate-cloud-b"
            style={{
              background:
                'radial-gradient(ellipse 62% 50% at 55% 50%, rgba(164,136,88,0.2) 0%, rgba(44,52,72,0.18) 52%, transparent 80%)',
              filter: compact ? 'blur(14px)' : 'blur(68px)',
            }}
          />
        </>
      )}

      {loopId === 'dust-motes' && (
        <>
          <div
            className="absolute inset-0 animate-glow-breathe"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(218,180,104,0.16) 0%, transparent 70%)',
            }}
          />
          {moteList.map((m) => (
            <span
              key={m.id}
              className="absolute rounded-full animate-particle"
              style={
                {
                  left: m.left,
                  top: m.top,
                  width: compact ? Math.max(2, m.size * 0.6) : m.size * 1.35,
                  height: compact ? Math.max(2, m.size * 0.6) : m.size * 1.35,
                  background:
                    m.id % 2 === 0
                      ? 'rgba(255, 246, 224, 0.9)'
                      : 'rgba(226, 188, 112, 0.85)',
                  boxShadow: '0 0 12px rgba(226, 188, 112, 0.55)',
                  '--particle-duration': m.duration,
                  '--particle-delay': m.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}

      {loopId === 'sanctuary-aurora' && (
        <>
          <div
            className="absolute -inset-x-[14%] top-[8%] h-[64%] rounded-full animate-aurora-wave"
            style={{
              background:
                'linear-gradient(115deg, transparent 10%, rgba(74,108,168,0.28) 38%, rgba(212,175,99,0.24) 64%, transparent 90%)',
              filter: compact ? 'blur(12px)' : 'blur(54px)',
            }}
          />
          <div
            className="absolute -inset-x-[10%] bottom-[4%] h-[52%] rounded-full animate-cloud-b"
            style={{
              background:
                'linear-gradient(100deg, transparent 15%, rgba(212,175,99,0.18) 45%, rgba(62,88,136,0.2) 72%, transparent 92%)',
              filter: compact ? 'blur(12px)' : 'blur(56px)',
            }}
          />
        </>
      )}

      {loopId === 'ember-glow' && (
        <>
          <div
            className="absolute inset-x-0 bottom-0 h-[55%] animate-glow-breathe"
            style={{
              background:
                'radial-gradient(ellipse 75% 80% at 50% 100%, rgba(224,148,68,0.26) 0%, rgba(168,94,38,0.08) 55%, transparent 85%)',
            }}
          />
          {moteList.map((m) => (
            <span
              key={m.id}
              className="absolute rounded-full animate-ember-rise"
              style={
                {
                  left: m.left,
                  top: `${62 + ((m.id * 9) % 34)}%`,
                  width: compact ? 2.5 : m.size * 1.25,
                  height: compact ? 2.5 : m.size * 1.25,
                  background:
                    m.id % 2 === 0
                      ? 'rgba(255, 206, 122, 0.92)'
                      : 'rgba(240, 148, 72, 0.85)',
                  boxShadow: '0 0 10px rgba(240, 156, 76, 0.6)',
                  '--particle-duration': m.duration,
                  '--particle-delay': m.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}

      {loopId === 'starlight-mist' && (
        <>
          <div
            className="absolute inset-0 animate-cloud-a"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 38% 35%, rgba(92,118,168,0.22) 0%, transparent 72%)',
            }}
          />
          {moteList.slice(0, compact ? 5 : 12).map((m) => (
            <span
              key={m.id}
              className="absolute rounded-full animate-glow-breathe"
              style={{
                left: m.left,
                top: `${(m.id * 13 + 8) % 68}%`,
                width: compact ? 2 : 3.5,
                height: compact ? 2 : 3.5,
                background: 'rgba(232, 240, 255, 0.78)',
                animationDelay: m.delay,
              }}
            />
          ))}
        </>
      )}

      {loopId === 'morning-rays' && (
        <>
          <div
            className="absolute inset-x-0 -top-[20%] h-[90%] animate-glow-breathe"
            style={{
              background:
                'radial-gradient(ellipse 85% 65% at 50% 0%, rgba(250,218,146,0.34) 0%, rgba(212,175,99,0.1) 52%, transparent 82%)',
            }}
          />
          <div
            className="absolute -top-[25%] left-[22%] w-[56%] h-[140%] animate-golden-sweep"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,238,192,0.28) 0%, rgba(212,175,99,0.06) 60%, transparent 90%)',
              filter: compact ? 'blur(10px)' : 'blur(40px)',
            }}
          />
        </>
      )}
    </div>
  );
};

interface AtmosphericBackgroundLibraryProps {
  activeLoopId?: AtmosphericLoopId;
  sceneSlideCount: number;
  onSelectSlideLoop: (loopId: AtmosphericLoopId) => void;
  onApplyLoopToScene: (loopId: AtmosphericLoopId) => void;
}

export const AtmosphericBackgroundLibrary: React.FC<
  AtmosphericBackgroundLibraryProps
> = ({
  activeLoopId = 'none',
  sceneSlideCount,
  onSelectSlideLoop,
  onApplyLoopToScene,
}) => {
  const [filter, setFilter] = useState<'all' | 'praise' | 'prayer'>('all');

  const visibleLoops = ATMOSPHERIC_LOOPS.filter(
    (item) =>
      filter === 'all' || item.category === filter || item.category === 'all'
  );

  const activeMeta =
    ATMOSPHERIC_LOOPS.find((item) => item.id === activeLoopId) ||
    ATMOSPHERIC_LOOPS[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF63] shrink-0" />
          <span className="text-xs font-semibold text-[#FAF8F4] truncate">
            Atmospheric Motion Loops
          </span>
        </div>
        {sceneSlideCount > 1 && (
          <button
            type="button"
            onClick={() => onApplyLoopToScene(activeLoopId)}
            className="text-[11px] font-medium text-[#D4AF63] hover:text-[#E8C988] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline"
          >
            Apply to Scene ({sceneSlideCount})
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090B10] border border-white/[0.06]">
        {(
          [
            { id: 'all', label: 'All Loops' },
            { id: 'praise', label: 'Praise' },
            { id: 'prayer', label: 'Prayer & Word' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF63]/60 ${
              filter === tab.id
                ? 'bg-[#1B202C] text-[#FAF8F4]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Curated Live-Animated Worship Loop Grid */}
      <div className="grid grid-cols-2 gap-2">
        {visibleLoops.map((loop) => {
          const isSelected = activeLoopId === loop.id;
          return (
            <button
              key={loop.id}
              type="button"
              onClick={() => onSelectSlideLoop(loop.id)}
              title={loop.description}
              className={`group relative overflow-hidden rounded-lg border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70 ${
                isSelected
                  ? 'border-[#D4AF63] ring-1 ring-[#D4AF63]/35'
                  : 'border-white/[0.08] hover:border-white/25'
              }`}
            >
              <div className="relative h-14 w-full bg-[#07080B] overflow-hidden">
                <AtmosphericLoopRenderer loopId={loop.id} compact={true} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-1.5 left-2.5 right-2.5">
                  <p className="text-[11px] font-semibold text-[#FAF8F4] truncate leading-tight">
                    {loop.name}
                  </p>
                  <p className="text-[10px] text-[#E3C17A]/90 truncate leading-tight mt-0.5">
                    {loop.mood}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
        <span className="text-[#E3C17A] font-medium">{activeMeta.name}</span>
        <span className="text-white/25 mx-1.5" aria-hidden="true">
          ·
        </span>
        {activeMeta.description}
      </p>
    </div>
  );
};
