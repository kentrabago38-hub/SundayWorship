export type ServicePart = 'opening' | 'part1' | 'part2' | 'closing';

export type SlideLayoutType =
  | 'opening'
  | 'section-transition'
  | 'prayer'
  | 'preliminaries'
  | 'birthday-single'
  | 'birthday-multi'
  | 'anniversary'
  | 'welcome'
  | 'announcement-title'
  | 'announcement-item'
  | 'additional-program'
  | 'call-to-worship'
  | 'invocation'
  | 'song-title'
  | 'lyric'
  | 'scripture-reading'
  | 'responsive-reading'
  | 'communion'
  | 'sermon-title'
  | 'sermon-point'
  | 'sermon-scripture'
  | 'sermon-takeaway'
  | 'offering-title'
  | 'offering-ways'
  | 'doxology'
  | 'benediction'
  | 'final';

export type ProgramVariation =
  | 'Special Number'
  | 'Testimony'
  | 'Guest Speaker'
  | 'Recognition'
  | 'Communion'
  | 'Video Presentation'
  | 'Prayer Request'
  | 'Mission Report'
  | 'Church Celebration'
  | 'Special Announcement';

export type DisplayStyle = 'centered' | 'lower-third';
export type TextScaleOption = 'standard' | 'large';
export type TvTimerPosition =
  | 'top-right'
  | 'bottom-right'
  | 'bottom-center'
  | 'top-left';

export type AtmosphericLoopId =
  | 'none'
  | 'golden-light'
  | 'slow-clouds'
  | 'dust-motes'
  | 'sanctuary-aurora'
  | 'ember-glow'
  | 'starlight-mist'
  | 'morning-rays';

export type SlideTransitionType = 'fade' | 'dissolve' | 'slide';

export interface ServiceTimerState {
  mode: 'clock-target' | 'duration';
  targetTimeStr: string;
  countdownTargetMs: number | null;
  countdownLabel: string;
  showOnTv: boolean;
  tvPosition: TvTimerPosition;
  showClockOnTv: boolean;
}

export interface SlideData {
  id: string;
  label: string;
  layout: SlideLayoutType;
  kicker?: string;
  title: string;
  subtitle?: string;
  body?: string;
  lines?: string[];
  metaPrimary?: string;
  metaSecondary?: string;
  metaTertiary?: string;
  pointNumber?: string;
  peopleList?: { name: string; date: string }[];
  variationTag?: ProgramVariation;
  givingMethods?: { label: string; detail: string }[];
  qrPayload?: string;
  backgroundImage?: string;
  atmosphericLoop?: AtmosphericLoopId;
  ambientIntensity?: 'subtle' | 'warm' | 'celebration' | 'cinematic';
  transitionType?: SlideTransitionType;
  transitionDurationSec?: number;
  displayStyle?: DisplayStyle;
  textScale?: TextScaleOption;
  operatorNote?: string;
  autoScrollEnabled?: boolean;
  autoScrollDurationSec?: number;
  autoScrollAutoStart?: boolean;
}

export interface AutoScrollPlaybackState {
  slideId: string;
  isPlaying: boolean;
  startedAt: number | null;
  pausedElapsedMs: number;
}

export interface ServiceScene {
  id: string;
  code: string;
  name: string;
  part: ServicePart;
  category: string;
  slides: SlideData[];
}

export interface ServiceSettings {
  churchName: string;
  serviceDate: string;
  themeScripture: string;
  nextServiceDate: string;
  socialContact: string;
}

export type OutputOverride = 'live' | 'blackout' | 'clear-text' | 'hold-opening';

export interface LivePresentationState {
  settings: ServiceSettings;
  scenes: ServiceScene[];
  activeSceneId: string;
  activeSlideId: string;
  override: OutputOverride;
  autoScrollPlayback?: AutoScrollPlaybackState;
  serviceTimer?: ServiceTimerState;
  updatedAt: number;
}

export type TemplateCategory =
  | 'prayer'
  | 'announcement'
  | 'birthday'
  | 'anniversary'
  | 'scripture'
  | 'responsive-reading'
  | 'song'
  | 'song-autoscroll'
  | 'communion'
  | 'sermon'
  | 'offering'
  | 'altar-call'
  | 'additional-program'
  | 'closing';
