import React, { useEffect, useRef, useState } from 'react';
import { Clock, Monitor, Timer } from 'lucide-react';
import { ServiceTimerState, TvTimerPosition } from '../types/presentation';

export function computeTargetMsForTimeStr(
  timeStr: string,
  nowMs: number = Date.now()
): number {
  const [rawH, rawM] = timeStr.split(':').map((v) => Number(v));
  const hours = Number.isFinite(rawH) ? Math.min(23, Math.max(0, rawH)) : 9;
  const minutes = Number.isFinite(rawM) ? Math.min(59, Math.max(0, rawM)) : 30;
  const target = new Date(nowMs);
  target.setHours(hours, minutes, 0, 0);
  // If chosen start time already passed by more than 1 minute today, schedule for tomorrow
  if (target.getTime() < nowMs - 60_000) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

export function createDefaultServiceTimer(): ServiceTimerState {
  const now = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  const targetTimeStr =
    hhmm < 9 * 60 + 30
      ? '09:30'
      : hhmm < 11 * 60 + 15
        ? '11:15'
        : hhmm < 18 * 60
          ? '18:00'
          : '09:30';

  return {
    mode: 'clock-target',
    targetTimeStr,
    countdownTargetMs: computeTargetMsForTimeStr(targetTimeStr, now.getTime()),
    countdownLabel: 'Service Begins In',
    showOnTv: false,
    tvPosition: 'bottom-right',
    showClockOnTv: true,
  };
}

export function getRemainingMs(
  timer: ServiceTimerState,
  nowMs: number = Date.now()
): number {
  if (!timer.countdownTargetMs) return 0;
  return Math.max(0, timer.countdownTargetMs - nowMs);
}

export function formatServiceClock(nowMs: number): string {
  return new Date(nowMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface ServiceTimerWidgetProps {
  timer: ServiceTimerState;
  onChange: (next: ServiceTimerState) => void;
}

const QUICK_LABELS = [
  'Service Begins In',
  'Worship Starts In',
  'Pre-Service Countdown',
  'Service Resumes In',
];

const POSITION_OPTIONS: { id: TvTimerPosition; label: string }[] = [
  { id: 'top-right', label: 'Top Right' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'top-left', label: 'Top Left' },
];

export const ServiceTimerWidget: React.FC<ServiceTimerWidgetProps> = ({
  timer,
  onChange,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPopoverOpen]);

  const remainingMs = getRemainingMs(timer, nowMs);
  const isFinished = remainingMs === 0;
  const isFinalFiveMin = remainingMs > 0 && remainingMs <= 5 * 60_000;

  const setPresetSeconds = (seconds: number) => {
    const now = Date.now();
    const target = now + seconds * 1000;
    const d = new Date(target);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    onChange({
      ...timer,
      mode: 'duration',
      targetTimeStr: `${hh}:${mm}`,
      countdownTargetMs: target,
    });
  };

  const setTargetStartTime = (nextTimeStr: string) => {
    if (!nextTimeStr) return;
    const now = Date.now();
    onChange({
      ...timer,
      mode: 'clock-target',
      targetTimeStr: nextTimeStr,
      countdownTargetMs: computeTargetMsForTimeStr(nextTimeStr, now),
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2 shrink-0"
    >
      {/* Current Service Clock + Clickable Countdown */}
      <div className="flex items-center h-8 rounded-lg bg-[#12151E] border border-white/[0.09] divide-x divide-white/[0.08] overflow-hidden">
        <div
          className="flex items-center gap-1.5 px-2.5 h-full text-[11px] font-mono tabular-nums text-[#F3EFE6] whitespace-nowrap shrink-0"
          title="Current local service clock"
        >
          <Clock className="w-3 h-3 text-[#D4AF63]" />
          <span>{formatServiceClock(nowMs)}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsPopoverOpen((v) => !v)}
          title="Configure service start time and countdown"
          className="flex items-center gap-1.5 px-2.5 h-full text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0 hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:bg-white/[0.06]"
        >
          <Timer
            className={`w-3 h-3 ${
              isFinished
                ? 'text-emerald-400'
                : isFinalFiveMin
                  ? 'text-amber-300'
                  : 'text-[#94A3B8]'
            }`}
          />
          <span
            className={
              isFinished
                ? 'text-emerald-400 font-semibold'
                : isFinalFiveMin
                  ? 'text-amber-300 font-semibold'
                  : 'text-[#E3C17A] font-medium'
            }
          >
            {isFinished ? '00:00 Live' : `T-${formatCountdown(remainingMs)}`}
          </span>
        </button>

        {/* TV Transparent Overlay Toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...timer, showOnTv: !timer.showOnTv })}
          title="Toggle transparent countdown overlay on TV output"
          className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none ${
            timer.showOnTv
              ? 'bg-[#D4AF63]/18 text-[#F3DFA8]'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Monitor className="w-3 h-3" />
          <span>{timer.showOnTv ? 'TV Overlay On' : 'TV Overlay'}</span>
        </button>
      </div>

      {/* Countdown Configuration Popover */}
      {isPopoverOpen && (
        <div className="absolute right-0 top-full mt-2 w-[320px] rounded-xl border border-white/12 bg-[#0F1219] shadow-2xl p-4 z-50 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#FAF8F4]">
              Service Clock & Countdown
            </span>
            <span className="text-[11px] font-mono text-[#E3C17A] tabular-nums">
              Start {timer.targetTimeStr}
            </span>
          </div>

          {/* Exact Start Time Picker */}
          <div>
            <label className="block text-[11px] text-[#94A3B8] mb-1">
              Target Service Start Time
            </label>
            <input
              type="time"
              value={timer.targetTimeStr}
              onChange={(e) => setTargetStartTime(e.target.value)}
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF63]"
            />
          </div>

          {/* Quick Countdown Presets */}
          <div>
            <label className="block text-[11px] text-[#94A3B8] mb-1.5">
              Quick Cue & Pre-Service Countdown
            </label>
            <div className="grid grid-cols-6 gap-1">
              {[
                { label: '30s', sec: 30 },
                { label: '1m', sec: 60 },
                { label: '3m', sec: 180 },
                { label: '5m', sec: 300 },
                { label: '10m', sec: 600 },
                { label: '15m', sec: 900 },
              ].map((preset) => (
                <button
                  key={preset.sec}
                  type="button"
                  onClick={() => setPresetSeconds(preset.sec)}
                  className="py-1.5 rounded-md bg-[#181C27] hover:bg-[#222838] border border-white/[0.08] text-[11px] font-mono tabular-nums text-[#E3C17A] transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay Label */}
          <div>
            <label className="block text-[11px] text-[#94A3B8] mb-1">
              TV Overlay Heading
            </label>
            <input
              type="text"
              value={timer.countdownLabel}
              onChange={(e) =>
                onChange({ ...timer, countdownLabel: e.target.value })
              }
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF63]"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {QUICK_LABELS.map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => onChange({ ...timer, countdownLabel: lbl })}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    timer.countdownLabel === lbl
                      ? 'border-[#D4AF63]/50 text-[#F3DFA8] bg-[#D4AF63]/10'
                      : 'border-white/[0.08] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* TV Corner Placement */}
          <div>
            <label className="block text-[11px] text-[#94A3B8] mb-1.5">
              TV Overlay Placement (Inside Safe Area)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {POSITION_OPTIONS.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => onChange({ ...timer, tvPosition: pos.id })}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                    timer.tvPosition === pos.id
                      ? 'bg-[#D4AF63]/15 border-[#D4AF63]/50 text-[#F3DFA8]'
                      : 'bg-[#161A24] border-white/[0.08] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.08] cursor-pointer">
            <span className="text-[11px] text-[#CBD5E1]">
              Show current clock beside countdown
            </span>
            <input
              type="checkbox"
              checked={timer.showClockOnTv}
              onChange={(e) =>
                onChange({ ...timer, showClockOnTv: e.target.checked })
              }
              className="accent-[#D4AF63] w-3.5 h-3.5"
            />
          </label>
        </div>
      )}
    </div>
  );
};
