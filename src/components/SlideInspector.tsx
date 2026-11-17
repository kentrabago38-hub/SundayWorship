import React, { useState } from 'react';
import {
  Copy,
  FileText,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  Radio,
  RotateCcw,
  ScrollText,
  Settings2,
  Trash2,
} from 'lucide-react';
import { IMAGES, PROGRAM_VARIATIONS } from '../data/defaultService';
import {
  AtmosphericLoopId,
  ProgramVariation,
  ServiceScene,
  ServiceSettings,
  SlideData,
  SlideTransitionType,
} from '../types/presentation';
import { AtmosphericBackgroundLibrary } from './AtmosphericBackgroundLibrary';
import {
  estimateAutoScrollMetrics,
  getDefaultTransitionDuration,
  getDefaultTransitionType,
} from './SlideCanvas';

interface SlideInspectorProps {
  scene: ServiceScene;
  slide: SlideData;
  isFocusLive: boolean;
  onTakeFocusLive: () => void;
  settings: ServiceSettings;
  onUpdateSettings: (next: ServiceSettings) => void;
  onUpdateSlide: (slideId: string, patch: Partial<SlideData>) => void;
  onApplyBackdropToScene: (backgroundImage?: string) => void;
  onApplyLoopToScene: (atmosphericLoop: AtmosphericLoopId) => void;
  onApplyTransitionToScene: (
    transitionType: SlideTransitionType,
    transitionDurationSec: number
  ) => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onAddQuickSlide: () => void;
}

const BACKDROP_OPTIONS = [
  { label: 'Obsidian Ambient', value: '' },
  { label: 'Sanctuary Light', value: IMAGES.opening },
  { label: 'Worship Stage', value: IMAGES.worship },
  { label: 'Cathedral Sunbeams', value: IMAGES.cathedral },
  { label: 'Prayer Sanctuary', value: IMAGES.prayer },
  { label: 'Open Scripture', value: IMAGES.scripture },
  { label: 'Communion Chalice', value: IMAGES.communion },
  { label: 'Community Foyer', value: IMAGES.welcome },
  { label: 'Olive & Gold', value: IMAGES.anniversary },
  { label: 'Sunrise Doors', value: IMAGES.benediction },
];

type InspectorTab = 'content' | 'stage' | 'service';

export const SlideInspector: React.FC<SlideInspectorProps> = ({
  scene,
  slide,
  isFocusLive,
  onTakeFocusLive,
  settings,
  onUpdateSettings,
  onUpdateSlide,
  onApplyBackdropToScene,
  onApplyLoopToScene,
  onApplyTransitionToScene,
  onDuplicateSlide,
  onDeleteSlide,
  onAddQuickSlide,
}) => {
  const [tab, setTab] = useState<InspectorTab>('content');

  const applyProgramVariation = (variation: ProgramVariation) => {
    const preset = PROGRAM_VARIATIONS.find((p) => p.variation === variation);
    if (!preset) return;
    onUpdateSlide(slide.id, {
      variationTag: preset.variation,
      title: preset.title,
      metaPrimary: preset.person,
      subtitle: preset.description,
    });
  };

  const showStageLayoutControls =
    (slide.layout === 'lyric' && !slide.autoScrollEnabled) ||
    slide.layout === 'scripture-reading' ||
    slide.layout === 'responsive-reading';

  return (
    <aside className="w-[336px] xl:w-[368px] shrink-0 border-l border-white/[0.08] bg-[#0D0F14] flex flex-col h-full overflow-hidden">
      {/* 3-Tab Segmented Switcher */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0A0C11]">
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#12151E] border border-white/[0.06]"
          role="tablist"
          aria-label="Inspector sections"
        >
          {(
            [
              { id: 'content', label: 'Content', icon: FileText },
              { id: 'stage', label: 'Stage & Look', icon: Palette },
              { id: 'service', label: 'Service', icon: Settings2 },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                  active
                    ? 'bg-[#222634] text-[#FAF8F4] shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#D4AF63]' : ''}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pinned Active/Focus Slide Header (always accessible in Content & Stage tabs) */}
      {tab !== 'service' && (
        <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0B0D12] space-y-2 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-[#D4AF63] tracking-wider uppercase tabular-nums">
                Scene {scene.code} · {scene.category}
              </p>
              <h3 className="text-sm font-semibold text-[#FAF8F4] truncate mt-0.5">
                {slide.label}
              </h3>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={onAddQuickSlide}
                title="Add new slide to this scene"
                className="p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDuplicateSlide(slide.id)}
                title="Duplicate slide"
                className="p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60"
              >
                <Copy className="w-4 h-4" />
              </button>
              {scene.slides.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteSlide(slide.id)}
                  title="Delete slide"
                  className="p-1.5 rounded-md text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span
              className={
                isFocusLive ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'
              }
            >
              {isFocusLive
                ? 'Live on TV · Edits sync immediately'
                : 'Focus Draft · Audience stays on Active slide'}
            </span>
            {!isFocusLive && (
              <button
                type="button"
                onClick={onTakeFocusLive}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#D4AF63] hover:bg-[#E2BF76] text-[#0A0B0E] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70"
              >
                <Radio className="w-3 h-3" />
                Send Live
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Service Info */}
      {tab === 'service' && (
        <div className="flex-1 overflow-y-auto operator-scroll p-4 space-y-4">
          <div className="pb-3 border-b border-white/[0.07]">
            <h3 className="text-sm font-semibold text-[#FAF8F4]">
              Sunday Service Details
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
              Automatically fills [CHURCH NAME], [DATE], [THEME / SCRIPTURE], and dismissal info across slides.
            </p>
          </div>

          <FieldInput
            label="Church Name"
            value={settings.churchName}
            onChange={(val) =>
              onUpdateSettings({ ...settings, churchName: val })
            }
          />
          <FieldInput
            label="Service Date"
            value={settings.serviceDate}
            onChange={(val) =>
              onUpdateSettings({ ...settings, serviceDate: val })
            }
          />
          <FieldInput
            label="Theme / Scripture"
            value={settings.themeScripture}
            onChange={(val) =>
              onUpdateSettings({ ...settings, themeScripture: val })
            }
          />
          <FieldInput
            label="Next Service Schedule"
            value={settings.nextServiceDate}
            onChange={(val) =>
              onUpdateSettings({ ...settings, nextServiceDate: val })
            }
          />
          <FieldInput
            label="Social Media / Contact"
            value={settings.socialContact}
            onChange={(val) =>
              onUpdateSettings({ ...settings, socialContact: val })
            }
          />
        </div>
      )}

      {/* Tab 2: Content */}
      {tab === 'content' && (
        <div className="flex-1 overflow-y-auto operator-scroll p-4 space-y-4">
          {/* Additional Program Quick Variation Picker */}
          {slide.layout === 'additional-program' && (
            <div className="space-y-2 pb-4 border-b border-white/[0.07]">
              <label className="block text-xs font-medium text-[#CBD5E1]">
                Program Variation Template
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PROGRAM_VARIATIONS.map((item) => {
                  const active = slide.variationTag === item.variation;
                  return (
                    <button
                      key={item.variation}
                      type="button"
                      onClick={() => applyProgramVariation(item.variation)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md text-left truncate transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                        active
                          ? 'bg-[#D4AF63]/15 border-[#D4AF63]/50 text-[#F3DFA8]'
                          : 'bg-[#12151E] border-white/[0.07] text-[#94A3B8] hover:text-white hover:border-white/15'
                      }`}
                    >
                      {item.variation}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slide Label */}
          <FieldInput
            label="Cue Label (Operator Only)"
            value={slide.label}
            onChange={(val) => onUpdateSlide(slide.id, { label: val })}
          />

          {/* Kicker / Header */}
          {slide.layout !== 'lyric' && (
            <FieldInput
              label="Section Kicker"
              value={slide.kicker || ''}
              onChange={(val) => onUpdateSlide(slide.id, { kicker: val })}
            />
          )}

          {/* Sermon Point Number */}
          {slide.layout === 'sermon-point' && (
            <FieldInput
              label="Point Number"
              value={slide.pointNumber || '01'}
              onChange={(val) => onUpdateSlide(slide.id, { pointNumber: val })}
            />
          )}

          {/* Primary Title */}
          {slide.layout !== 'doxology' && (
            <FieldTextarea
              label={
                slide.layout === 'lyric'
                  ? 'Song Reference'
                  : slide.layout === 'call-to-worship' ||
                      slide.layout === 'scripture-reading' ||
                      slide.layout === 'responsive-reading' ||
                      slide.layout === 'sermon-scripture'
                    ? 'Scripture Reference'
                    : slide.layout === 'communion'
                      ? 'Words of Institution'
                      : 'Main Title / Display Headline'
              }
              rows={2}
              value={slide.title}
              onChange={(val) => onUpdateSlide(slide.id, { title: val })}
            />
          )}

          {/* Subtitle */}
          {(slide.subtitle !== undefined ||
            [
              'opening',
              'section-transition',
              'prayer',
              'invocation',
              'preliminaries',
              'birthday-single',
              'birthday-multi',
              'anniversary',
              'welcome',
              'announcement-title',
              'additional-program',
              'song-title',
              'sermon-point',
              'offering-title',
              'benediction',
              'final',
            ].includes(slide.layout)) && (
            <FieldTextarea
              label="Supporting Text / Subtitle"
              rows={2}
              value={slide.subtitle || ''}
              onChange={(val) => onUpdateSlide(slide.id, { subtitle: val })}
            />
          )}

          {/* Multi-Line Lyrics / Call to Worship / Responsive Reading / Doxology */}
          {(slide.layout === 'lyric' ||
            slide.layout === 'call-to-worship' ||
            slide.layout === 'responsive-reading' ||
            slide.layout === 'doxology') && (
            <div className="space-y-4">
              <FieldTextarea
                label={
                  slide.layout === 'lyric'
                    ? slide.autoScrollEnabled
                      ? 'Full Lyrics (Supports [Verse 1], [Chorus], [Bridge] tags)'
                      : 'Lyrics (Supports [Verse 1], [Chorus], [Bridge] tags)'
                    : slide.layout === 'responsive-reading'
                      ? 'Responsive Lines (Prefix Leader: or Congregation:)'
                      : 'Lines (One Line per Row)'
                }
                rows={slide.autoScrollEnabled ? 9 : 5}
                value={(slide.lines || []).join('\n')}
                onChange={(val) =>
                  onUpdateSlide(slide.id, {
                    lines:
                      slide.layout === 'lyric' && slide.autoScrollEnabled
                        ? val.split('\n')
                        : val.split('\n').slice(0, 6),
                  })
                }
              />

              {slide.layout === 'lyric' && (
                <div className="pt-4 border-t border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ScrollText className="w-3.5 h-3.5 text-[#D4AF63]" />
                      <span className="text-xs font-medium text-[#CBD5E1]">
                        Auto-Scroll Lyrics
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSlide(slide.id, {
                          autoScrollEnabled: !slide.autoScrollEnabled,
                          autoScrollDurationSec:
                            slide.autoScrollDurationSec ?? 180,
                          autoScrollAutoStart:
                            slide.autoScrollAutoStart ?? true,
                        })
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                        slide.autoScrollEnabled
                          ? 'bg-[#D4AF63] text-[#0A0B0E]'
                          : 'bg-[#171B26] border border-white/[0.08] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {slide.autoScrollEnabled ? 'Enabled' : 'Off'}
                    </button>
                  </div>

                  {slide.autoScrollEnabled && (
                    <AutoScrollDurationControls
                      slide={slide}
                      onUpdate={(patch) => onUpdateSlide(slide.id, patch)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Body Text for Scripture / Communion / Announcements / Preliminaries */}
          {(slide.layout === 'scripture-reading' ||
            slide.layout === 'sermon-scripture' ||
            slide.layout === 'communion' ||
            slide.layout === 'announcement-item' ||
            slide.layout === 'preliminaries') && (
            <FieldTextarea
              label={
                slide.layout === 'communion'
                  ? 'Communion Reflection / Scripture'
                  : 'Passage / Body Text'
              }
              rows={4}
              value={slide.body || ''}
              onChange={(val) => onUpdateSlide(slide.id, { body: val })}
            />
          )}

          {/* Meta Fields */}
          {slide.layout !== 'lyric' &&
            slide.layout !== 'doxology' &&
            slide.layout !== 'birthday-multi' && (
              <div className="grid grid-cols-1 gap-3">
                <FieldInput
                  label={
                    slide.layout === 'announcement-item'
                      ? 'Date • Time'
                      : slide.layout === 'anniversary'
                        ? 'Years Celebrated'
                        : slide.layout === 'additional-program'
                          ? 'Person / Group'
                          : slide.layout === 'sermon-title'
                            ? 'Speaker'
                            : 'Primary Detail'
                  }
                  value={slide.metaPrimary || ''}
                  onChange={(val) =>
                    onUpdateSlide(slide.id, { metaPrimary: val })
                  }
                />
                {(slide.metaSecondary !== undefined ||
                  slide.layout === 'announcement-item' ||
                  slide.layout === 'sermon-title' ||
                  slide.layout === 'opening' ||
                  slide.layout === 'final') && (
                  <FieldInput
                    label={
                      slide.layout === 'announcement-item'
                        ? 'Location'
                        : slide.layout === 'sermon-title'
                          ? 'Sermon Text'
                          : 'Secondary Detail'
                    }
                    value={slide.metaSecondary || ''}
                    onChange={(val) =>
                      onUpdateSlide(slide.id, { metaSecondary: val })
                    }
                  />
                )}
              </div>
            )}

          {/* Multiple Birthdays List */}
          {slide.layout === 'birthday-multi' && (
            <div className="pt-4 border-t border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#CBD5E1]">
                  Birthday Honorees
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSlide(slide.id, {
                      peopleList: [
                        ...(slide.peopleList || []),
                        { name: '[NAME]', date: '[DATE]' },
                      ],
                    })
                  }
                  className="text-[11px] font-medium text-[#D4AF63] hover:text-[#E8C988] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded px-1"
                >
                  + Add Person
                </button>
              </div>
              <div className="space-y-2">
                {(slide.peopleList || []).map((person, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-2"
                  >
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => {
                        const next = [...(slide.peopleList || [])];
                        next[idx] = { ...next[idx], name: e.target.value };
                        onUpdateSlide(slide.id, { peopleList: next });
                      }}
                      placeholder="Name"
                      className="bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                    />
                    <input
                      type="text"
                      value={person.date}
                      onChange={(e) => {
                        const next = [...(slide.peopleList || [])];
                        next[idx] = { ...next[idx], date: e.target.value };
                        onUpdateSlide(slide.id, { peopleList: next });
                      }}
                      placeholder="Date"
                      className="bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offering QR & Giving Methods */}
          {slide.layout === 'offering-ways' && (
            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              <FieldInput
                label="QR Code Giving URL"
                value={slide.qrPayload || ''}
                onChange={(val) => onUpdateSlide(slide.id, { qrPayload: val })}
              />
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-[#CBD5E1]">
                  Giving Methods
                </label>
                {(slide.givingMethods || []).map((method, idx) => (
                  <div
                    key={idx}
                    className="space-y-1.5 pb-2.5 border-b border-white/[0.05] last:border-b-0 last:pb-0"
                  >
                    <input
                      type="text"
                      value={method.label}
                      onChange={(e) => {
                        const next = [...(slide.givingMethods || [])];
                        next[idx] = { ...next[idx], label: e.target.value };
                        onUpdateSlide(slide.id, { givingMethods: next });
                      }}
                      className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#E3C17A] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                    />
                    <input
                      type="text"
                      value={method.detail}
                      onChange={(e) => {
                        const next = [...(slide.givingMethods || [])];
                        next[idx] = { ...next[idx], detail: e.target.value };
                        onUpdateSlide(slide.id, { givingMethods: next });
                      }}
                      className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operator Note */}
          <div className="pt-4 border-t border-white/[0.07]">
            <FieldTextarea
              label="Private Operator Note (Never Projected)"
              rows={2}
              value={slide.operatorNote || ''}
              onChange={(val) =>
                onUpdateSlide(slide.id, { operatorNote: val })
              }
            />
          </div>
        </div>
      )}

      {/* Tab 3: Stage & Look */}
      {tab === 'stage' && (
        <div className="flex-1 overflow-y-auto operator-scroll p-4 space-y-4">
          {/* Projection Style (Centered vs Lower-Third) & Text Size */}
          {showStageLayoutControls && (
            <div className="space-y-3 pb-4 border-b border-white/[0.07]">
              {slide.layout !== 'responsive-reading' && (
                <div>
                  <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                    Projection Layout
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'centered', label: 'Centered Full' },
                        { id: 'lower-third', label: 'Lower-Third' },
                      ] as const
                    ).map((opt) => {
                      const active =
                        (slide.displayStyle || 'centered') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdateSlide(slide.id, { displayStyle: opt.id })
                          }
                          className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                            active
                              ? 'bg-[#D4AF63]/15 border-[#D4AF63]/45 text-[#F3DFA8]'
                              : 'bg-[#12151E] border-white/[0.08] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                  Congregation Text Size
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'standard', label: 'Standard' },
                      { id: 'large', label: 'Large Print' },
                    ] as const
                  ).map((opt) => {
                    const active =
                      (slide.textScale || 'standard') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateSlide(slide.id, { textScale: opt.id })
                        }
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                          active
                            ? 'bg-[#D4AF63]/15 border-[#D4AF63]/45 text-[#F3DFA8]'
                            : 'bg-[#12151E] border-white/[0.08] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Static Still Worship Backdrop */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#CBD5E1]">
                <ImageIcon className="w-3.5 h-3.5 text-[#D4AF63]" />
                Worship Backdrop
              </label>
              {scene.slides.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyBackdropToScene(slide.backgroundImage)
                  }
                  className="text-[11px] font-medium text-[#D4AF63] hover:text-[#E8C988] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded px-1"
                >
                  Apply to Scene ({scene.slides.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {BACKDROP_OPTIONS.map((opt) => {
                const isSelected = (slide.backgroundImage || '') === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      onUpdateSlide(slide.id, {
                        backgroundImage: opt.value || undefined,
                      })
                    }
                    className={`group relative overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/70 ${
                      isSelected
                        ? 'border-[#D4AF63] ring-1 ring-[#D4AF63]/40'
                        : 'border-white/[0.08] hover:border-white/25'
                    }`}
                  >
                    <div className="relative h-11 w-full bg-[#090B10] overflow-hidden">
                      {opt.value ? (
                        <img
                          src={opt.value}
                          alt={opt.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{
                            background:
                              'radial-gradient(circle at 50% 35%, rgba(212,175,99,0.22), #07080B 80%)',
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <span className="absolute bottom-1 left-2 right-2 text-[10px] font-medium text-[#FAF8F4] truncate">
                        {opt.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Curated Atmospheric Background Library */}
          <div className="pt-4 border-t border-white/[0.07]">
            <AtmosphericBackgroundLibrary
              activeLoopId={slide.atmosphericLoop || 'none'}
              sceneSlideCount={scene.slides.length}
              onSelectSlideLoop={(loopId) =>
                onUpdateSlide(slide.id, { atmosphericLoop: loopId })
              }
              onApplyLoopToScene={onApplyLoopToScene}
            />
          </div>

          {/* Motion & Particles */}
          <div className="pt-4 border-t border-white/[0.07]">
            <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
              Motion & Particles
            </label>
            <select
              value={slide.ambientIntensity || 'subtle'}
              onChange={(e) =>
                onUpdateSlide(slide.id, {
                  ambientIntensity: e.target.value as SlideData['ambientIntensity'],
                })
              }
              className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
            >
              <option value="subtle">Subtle (Lyrics / Prayer)</option>
              <option value="warm">Warm Glow (Community / Sermon)</option>
              <option value="celebration">Celebration Drift (Birthdays)</option>
              <option value="cinematic">Cinematic Rays (Opening / Transitions)</option>
            </select>
          </div>

          {/* Advanced Transition Panel */}
          <div className="pt-4 border-t border-white/[0.07]">
            <AdvancedTransitionPanel
              slide={slide}
              sceneSlideCount={scene.slides.length}
              onUpdate={(patch) => onUpdateSlide(slide.id, patch)}
              onApplyToScene={onApplyTransitionToScene}
            />
          </div>
        </div>
      )}
    </aside>
  );
};

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#FAF8F4] placeholder-[#64748B] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50 transition-colors"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  rows = 3,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#FAF8F4] placeholder-[#64748B] focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50 transition-colors leading-relaxed resize-y"
      />
    </div>
  );
}

function AutoScrollDurationControls({
  slide,
  onUpdate,
}: {
  slide: SlideData;
  onUpdate: (patch: Partial<SlideData>) => void;
}) {
  const totalSec = Math.max(10, slide.autoScrollDurationSec ?? 180);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const metrics = estimateAutoScrollMetrics(slide);

  const setDuration = (nextMins: number, nextSecs: number) => {
    const clamped = Math.max(10, Math.min(900, nextMins * 60 + nextSecs));
    onUpdate({ autoScrollDurationSec: clamped });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#94A3B8] font-medium">
          Expected Song Duration
        </span>
        <span className="font-mono text-[#E3C17A] tabular-nums">
          {metrics.pxPerSec.toFixed(1)} px/s · {metrics.linesPerMin.toFixed(1)} lines/m
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-[#94A3B8] mb-1">
            Minutes
          </label>
          <input
            type="number"
            min={0}
            max={15}
            value={mins}
            onChange={(e) =>
              setDuration(Math.max(0, Number(e.target.value) || 0), secs)
            }
            className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#94A3B8] mb-1">
            Seconds
          </label>
          <input
            type="number"
            min={0}
            max={59}
            value={secs}
            onChange={(e) =>
              setDuration(
                mins,
                Math.max(0, Math.min(59, Number(e.target.value) || 0))
              )
            }
            className="w-full bg-[#12151E] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-[#D4AF63] focus-visible:ring-1 focus-visible:ring-[#D4AF63]/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {[
          { label: '2:00', sec: 120 },
          { label: '3:00', sec: 180 },
          { label: '4:00', sec: 240 },
          { label: '5:00', sec: 300 },
        ].map((preset) => (
          <button
            key={preset.sec}
            type="button"
            onClick={() => onUpdate({ autoScrollDurationSec: preset.sec })}
            className={`flex-1 py-1 rounded-md text-[11px] font-mono tabular-nums transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
              totalSec === preset.sec
                ? 'bg-[#D4AF63]/15 border-[#D4AF63]/45 text-[#F3DFA8]'
                : 'bg-[#12151E] border-white/[0.08] text-[#94A3B8] hover:text-white'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
        <span className="text-[11px] text-[#CBD5E1]">
          Auto-start scroll when slide goes live
        </span>
        <input
          type="checkbox"
          checked={slide.autoScrollAutoStart ?? true}
          onChange={(e) =>
            onUpdate({ autoScrollAutoStart: e.target.checked })
          }
          className="accent-[#D4AF63] w-3.5 h-3.5"
        />
      </label>
    </div>
  );
}

const TRANSITION_TYPES: {
  id: SlideTransitionType;
  label: string;
  hint: string;
}[] = [
  { id: 'fade', label: 'Fade', hint: 'Clean opacity' },
  { id: 'dissolve', label: 'Dissolve', hint: 'Cinematic blend' },
  { id: 'slide', label: 'Slide', hint: 'Horizontal push' },
];

const DURATION_PRESETS = [
  { label: '0.5s Snappy', value: 0.5 },
  { label: '0.8s Smooth', value: 0.8 },
  { label: '1.4s Gentle', value: 1.4 },
  { label: '2.0s Cinematic', value: 2.0 },
];

function AdvancedTransitionPanel({
  slide,
  sceneSlideCount,
  onUpdate,
  onApplyToScene,
}: {
  slide: SlideData;
  sceneSlideCount: number;
  onUpdate: (patch: Partial<SlideData>) => void;
  onApplyToScene: (
    transitionType: SlideTransitionType,
    transitionDurationSec: number
  ) => void;
}) {
  const effectiveType =
    slide.transitionType ?? getDefaultTransitionType(slide.layout);
  const effectiveDuration =
    slide.transitionDurationSec ?? getDefaultTransitionDuration(slide.layout);
  const isCustomized =
    slide.transitionType !== undefined ||
    slide.transitionDurationSec !== undefined;

  const typeLabel =
    TRANSITION_TYPES.find((t) => t.id === effectiveType)?.label || 'Fade';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#D4AF63]" />
          <span className="font-medium text-[#CBD5E1]">Advanced Transition</span>
        </div>
        <span className="font-mono text-[11px] text-[#E3C17A] tabular-nums">
          {typeLabel} · {effectiveDuration.toFixed(1)}s
          {!isCustomized ? ' (Default)' : ''}
        </span>
      </div>

      {/* Transition Type Selector */}
      <div>
        <label className="block text-[11px] text-[#94A3B8] mb-1.5">
          Transition Style
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSITION_TYPES.map((t) => {
            const active = effectiveType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdate({ transitionType: t.id })}
                className={`px-2 py-2 rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                  active
                    ? 'bg-[#D4AF63]/15 border-[#D4AF63]/50 text-[#F3DFA8]'
                    : 'bg-[#12151E] border-white/[0.08] text-[#94A3B8] hover:text-white'
                }`}
              >
                <p className="text-[11px] font-semibold leading-tight">
                  {t.label}
                </p>
                <p className="text-[10px] opacity-75 truncate mt-0.5">
                  {t.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration Presets & Fine Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <label
            htmlFor="slide-transition-duration-range"
            className="text-[#94A3B8]"
          >
            Duration
          </label>
          <span className="font-mono text-[#FAF8F4] tabular-nums">
            {effectiveDuration.toFixed(1)}s
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {DURATION_PRESETS.map((preset) => {
            const isActive = Math.abs(effectiveDuration - preset.value) < 0.05;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  onUpdate({ transitionDurationSec: preset.value })
                }
                className={`px-2 py-1.5 rounded-md text-[11px] font-medium tabular-nums transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 ${
                  isActive
                    ? 'bg-[#D4AF63]/15 border-[#D4AF63]/45 text-[#F3DFA8]'
                    : 'bg-[#12151E] border-white/[0.08] text-[#94A3B8] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <input
          id="slide-transition-duration-range"
          type="range"
          min={0.2}
          max={3.0}
          step={0.1}
          value={effectiveDuration}
          onChange={(e) =>
            onUpdate({ transitionDurationSec: Number(e.target.value) })
          }
          aria-label="Transition duration in seconds"
          className="w-full accent-[#D4AF63] cursor-pointer h-1.5 bg-white/10 rounded-lg"
        />
      </div>

      {/* Reset & Apply to Scene Actions */}
      {(isCustomized || sceneSlideCount > 1) && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
          {isCustomized ? (
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  transitionType: undefined,
                  transitionDurationSec: undefined,
                })
              }
              className="flex items-center gap-1 text-[#94A3B8] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded px-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Default
            </button>
          ) : (
            <span />
          )}

          {sceneSlideCount > 1 && (
            <button
              type="button"
              onClick={() => onApplyToScene(effectiveType, effectiveDuration)}
              className="font-medium text-[#D4AF63] hover:text-[#E8C988] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF63]/60 rounded px-1"
            >
              Apply to Scene ({sceneSlideCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

