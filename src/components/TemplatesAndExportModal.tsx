import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileMusic,
  LayoutGrid,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { TEMPLATE_LIBRARY } from '../data/defaultService';
import {
  buildWorshipSceneFromLyrics,
  parseRawLyricsToChunks,
} from '../lib/lyricsParser';
import {
  ServiceScene,
  ServiceSettings,
  TemplateCategory,
} from '../types/presentation';

const SAMPLE_WORSHIP_LYRICS = `[Verse 1]
You give life, You are love
You bring light to the darkness
You give hope, You restore
Every heart that is broken

[Chorus]
Great are You, Lord
It's Your breath in our lungs
So we pour out our praise
We pour out our praise

[Bridge]
And all the earth will shout Your praise
Our hearts will cry, these bones will sing
Great are You, Lord`;

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTemplate: (category: TemplateCategory) => void;
  onInsertCustomScene: (
    createScene: (nextCode: string) => ServiceScene
  ) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onInsertTemplate,
  onInsertCustomScene,
}) => {
  const [mode, setMode] = useState<'templates' | 'paste-lyrics'>('templates');
  const [songTitle, setSongTitle] = useState('');
  const [songSubtitle, setSongSubtitle] = useState('');
  const [rawLyrics, setRawLyrics] = useState('');
  const [maxLinesPerSlide, setMaxLinesPerSlide] = useState<2 | 4>(4);
  const [includeTitleSlide, setIncludeTitleSlide] = useState(true);
  const [includeSectionTags, setIncludeSectionTags] = useState(true);

  const parsedChunks = useMemo(
    () => parseRawLyricsToChunks(rawLyrics, maxLinesPerSlide),
    [rawLyrics, maxLinesPerSlide]
  );

  if (!isOpen) return null;

  const totalSlideCount =
    parsedChunks.length + (parsedChunks.length > 0 && includeTitleSlide ? 1 : 0);

  const handleCreateWorshipScene = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedChunks.length === 0) return;

    const snapshot = {
      songTitle,
      subtitle: songSubtitle,
      rawLyrics,
      maxLinesPerSlide,
      includeTitleSlide,
      includeSectionTags,
    };

    onInsertCustomScene((nextCode) =>
      buildWorshipSceneFromLyrics(nextCode, snapshot)
    );

    setSongTitle('');
    setSongSubtitle('');
    setRawLyrics('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Insert Service Scene Template or Song Lyrics"
    >
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0D0F14] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#0A0C11] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#FAF8F4]">
              Add Service Scene
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Insert a reusable template or paste raw song lyrics to split into worship slides automatically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1 p-1 rounded-lg bg-[#12151E] border border-white/[0.06]"
              role="tablist"
              aria-label="Add scene mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'templates'}
                onClick={() => setMode('templates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                  mode === 'templates'
                    ? 'bg-[#222634] text-[#FAF8F4]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#D4AF63]" />
                Templates
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'paste-lyrics'}
                onClick={() => setMode('paste-lyrics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                  mode === 'paste-lyrics'
                    ? 'bg-[#222634] text-[#FAF8F4]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <FileMusic className="w-3.5 h-3.5 text-[#D4AF63]" />
                Paste Song Lyrics
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {mode === 'templates' ? (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto operator-scroll">
            {TEMPLATE_LIBRARY.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onInsertTemplate(tpl.id);
                  onClose();
                }}
                className="group text-left p-4 rounded-lg border border-white/[0.08] bg-[#12151E] hover:border-[#D4AF63]/55 hover:bg-[#171B26] transition-colors flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
              >
                <div>
                  <p className="text-sm font-semibold text-[#FAF8F4] group-hover:text-[#F3DFA8] transition-colors">
                    {tpl.name}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
                <span className="p-1.5 rounded-md bg-white/[0.05] text-[#D4AF63] shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={handleCreateWorshipScene}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto operator-scroll p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                    Song Title
                  </label>
                  <input
                    type="text"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    placeholder="e.g. Great Are You Lord"
                    className="w-full bg-[#12151E] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#FAF8F4] placeholder-[#64748B] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                    Key / Subtitle (Optional)
                  </label>
                  <input
                    type="text"
                    value={songSubtitle}
                    onChange={(e) => setSongSubtitle(e.target.value)}
                    placeholder="e.g. Key of A · Congregational Worship"
                    className="w-full bg-[#12151E] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#FAF8F4] placeholder-[#64748B] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-medium text-[#CBD5E1]">
                    Raw Song Lyrics (Split by blank lines or [Verse 1], [Chorus], [Bridge])
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!songTitle.trim()) setSongTitle('Great Are You Lord');
                      if (!songSubtitle.trim())
                        setSongSubtitle('Key of A · Congregational Worship');
                      setRawLyrics(SAMPLE_WORSHIP_LYRICS);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#D4AF63] hover:text-[#E8C988] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded px-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Load Sample
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={rawLyrics}
                  onChange={(e) => setRawLyrics(e.target.value)}
                  placeholder={`[Verse 1]\nLine 1...\nLine 2...\n\n[Chorus]\nLine 1...\nLine 2...`}
                  className="w-full bg-[#07080B] border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono text-[#FAF8F4] placeholder-[#475569] leading-relaxed focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50 resize-y"
                />
              </div>

              {/* Split & Formatting Options */}
              <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8]">Max Lines / Slide:</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-md bg-[#12151E] border border-white/[0.08]">
                    {([4, 2] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMaxLinesPerSlide(count)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                          maxLinesPerSlide === count
                            ? 'bg-[#D4AF63] text-[#0A0B0E] font-semibold'
                            : 'text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        {count} lines
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-[#CBD5E1]">
                    <input
                      type="checkbox"
                      checked={includeTitleSlide}
                      onChange={(e) => setIncludeTitleSlide(e.target.checked)}
                      className="accent-[#D4AF63] w-3.5 h-3.5"
                    />
                    Include Song Title Opener
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#CBD5E1]">
                    <input
                      type="checkbox"
                      checked={includeSectionTags}
                      onChange={(e) => setIncludeSectionTags(e.target.checked)}
                      className="accent-[#D4AF63] w-3.5 h-3.5"
                    />
                    Show Section Tags
                  </label>
                </div>
              </div>

              {/* Live Parsed Stanza Preview */}
              <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#CBD5E1]">
                    Parsed Worship Slides Preview
                  </span>
                  <span className="font-mono text-[11px] text-[#E3C17A] tabular-nums">
                    {parsedChunks.length > 0
                      ? `${totalSlideCount} ${totalSlideCount === 1 ? 'slide' : 'slides'} ready`
                      : 'Paste lyrics above to preview slides'}
                  </span>
                </div>

                {parsedChunks.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {includeTitleSlide && (
                      <div className="p-2.5 rounded-lg border border-white/[0.08] bg-[#12151E]">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF63]">
                          00 · Title Opener
                        </p>
                        <p className="text-xs font-semibold text-[#FAF8F4] truncate mt-0.5">
                          {songTitle.trim() ||
                            parsedChunks[0]?.lines[0]?.replace(/[.,;!?]+$/, '') ||
                            'New Worship Song'}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] truncate">
                          {songSubtitle.trim() || 'Congregational Worship'}
                        </p>
                      </div>
                    )}
                    {parsedChunks.map((chunk, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-white/[0.08] bg-[#12151E]"
                      >
                        <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF63] tabular-nums">
                          {String(idx + 1).padStart(2, '0')} · {chunk.slideLabel}
                        </p>
                        <p className="text-[11px] text-[#E2E8F0] mt-1 line-clamp-2 leading-relaxed">
                          {chunk.lines.join(' / ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#0A0C11] flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-[#94A3B8]">
                Added to Part 2 — Praise & Worship
              </span>
              <button
                type="submit"
                disabled={parsedChunks.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70 ${
                  parsedChunks.length > 0
                    ? 'bg-[#D4AF63] hover:bg-[#E2BF76] text-[#0A0B0E]'
                    : 'bg-[#1A1E29] text-[#64748B] cursor-not-allowed'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Worship Scene
                {parsedChunks.length > 0 ? ` (${totalSlideCount} Slides)` : ''}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface FreeShowExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: ServiceScene[];
  settings: ServiceSettings;
}

export const FreeShowExportModal: React.FC<FreeShowExportModalProps> = ({
  isOpen,
  onClose,
  scenes,
  settings,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const formattedCueSheet = buildFreeShowTextExport(scenes, settings);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedCueSheet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleDownloadJson = () => {
    const payload = {
      format: 'FreeShow-Ready Sunday Worship Package',
      version: '1.0',
      settings,
      rundown: scenes.map((s) => ({
        sceneCode: s.code,
        sceneName: `${s.code} - ${s.name}`,
        part: s.part,
        category: s.category,
        slides: s.slides.map((sl) => ({
          label: sl.label,
          layout: sl.layout,
          kicker: sl.kicker,
          title: sl.title,
          subtitle: sl.subtitle,
          lines: sl.lines,
          body: sl.body,
          metaPrimary: sl.metaPrimary,
          metaSecondary: sl.metaSecondary,
          transitionType: sl.transitionType,
          transitionDurationSec: sl.transitionDurationSec,
          displayStyle: sl.displayStyle,
          textScale: sl.textScale,
          atmosphericLoop: sl.atmosphericLoop,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sunday-worship-freeshow-rundown.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Export FreeShow Rundown and Lyrics"
    >
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0D0F14] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#0A0C11] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#FAF8F4]">
              FreeShow Service Export & Extended Display Guide
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Download the structured rundown or copy clean 2–4 line lyric & scripture blocks directly into FreeShow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#12151E]">
              <p className="font-semibold text-[#F3DFA8] mb-1">
                Dual-Screen TV / Projector Workflow
              </p>
              <p className="text-[#CBD5E1] leading-relaxed">
                Click <span className="text-white font-medium">TV Output Window</span> in the monitor bar, drag the clean 16:9 tab to your extended sanctuary TV/projector, and press F11 or click inside it for borderless projection.
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#12151E]">
              <p className="font-semibold text-[#F3DFA8] mb-1">
                Live Keyboard Shortcuts
              </p>
              <p className="text-[#CBD5E1] leading-relaxed">
                <span className="font-mono text-white">← / →</span> or <span className="font-mono text-white">Space</span> Next/Prev Slide · <span className="font-mono text-white">↑ / ↓</span> Switch Scene · <span className="font-mono text-white">B</span> Blackout · <span className="font-mono text-white">C</span> Clear Text · <span className="font-mono text-white">L</span> Hold Opening
              </p>
            </div>
          </div>

          <pre className="w-full h-64 overflow-y-auto operator-scroll p-4 rounded-lg bg-[#07080B] border border-white/[0.08] text-xs font-mono text-[#CBD5E1] whitespace-pre-wrap">
            {formattedCueSheet}
          </pre>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 bg-[#12151E] hover:bg-[#191E2A] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Cue Sheet
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy FreeShow Text
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF63] hover:bg-[#E2BF76] text-xs font-semibold text-[#0A0B0E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70"
            >
              <Download className="w-3.5 h-3.5" />
              Download FreeShow JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function buildFreeShowTextExport(
  scenes: ServiceScene[],
  settings: ServiceSettings
): string {
  const lines: string[] = [
    `SUNDAY WORSHIP SERVICE — ${settings.churchName}`,
    `${settings.serviceDate} | ${settings.themeScripture}`,
    '====================================================',
    '',
  ];

  for (const scene of scenes) {
    lines.push(`[SCENE ${scene.code}] ${scene.name.toUpperCase()} (${scene.category})`);
    for (const slide of scene.slides) {
      lines.push(`  -- ${slide.label} --`);
      if (slide.title) lines.push(`  ${slide.title}`);
      if (slide.subtitle) lines.push(`  ${slide.subtitle}`);
      if (slide.lines && slide.lines.length > 0) {
        slide.lines.forEach((l) => lines.push(`  ${l}`));
      }
      if (slide.body) lines.push(`  ${slide.body}`);
      if (slide.metaPrimary) lines.push(`  ${slide.metaPrimary}`);
      if (slide.metaSecondary) lines.push(`  ${slide.metaSecondary}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
