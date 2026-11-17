import { IMAGES } from '../data/defaultService';
import { ServiceScene, SlideData } from '../types/presentation';

export interface ParsedLyricChunk {
  slideLabel: string;
  sectionTag: string;
  lines: string[];
}

export interface ParseLyricsOptions {
  songTitle: string;
  subtitle?: string;
  rawLyrics: string;
  maxLinesPerSlide?: 2 | 4;
  includeTitleSlide?: boolean;
  includeSectionTags?: boolean;
}

const BRACKET_TAG_RE = /^\[([A-Za-z0-9\s\-–—·#&/:]+)\]$/;
const INLINE_BRACKET_TAG_RE = /^\[([A-Za-z0-9\s\-–—·#&/:]+)\]\s+(.+)$/;
const PLAIN_SECTION_RE =
  /^(Verse(?:\s*\d+)?|V\d+|Pre-?Chorus(?:\s*\d+)?|Chorus(?:\s*\d+)?|C\d*|Bridge(?:\s*\d+)?|B\d*|Intro|Outro|Tag(?:\s*\d+)?|Refrain(?:\s*\d+)?|Ending|Instrumental|Interlude|Vamp|Turnaround)\s*:?\s*$/i;

function normalizeSectionTag(raw: string): string {
  const cleaned = raw.replace(/[:[\]]+/g, '').trim().replace(/\s+/g, ' ');
  if (/^v(\d+)$/i.test(cleaned)) {
    return `Verse ${cleaned.slice(1)}`;
  }
  if (/^c(\d*)$/i.test(cleaned)) {
    const num = cleaned.slice(1);
    return num ? `Chorus ${num}` : 'Chorus';
  }
  if (/^b(\d*)$/i.test(cleaned)) {
    const num = cleaned.slice(1);
    return num ? `Bridge ${num}` : 'Bridge';
  }
  return cleaned;
}

interface RawStanza {
  tag?: string;
  lines: string[];
}

export function parseRawLyricsToChunks(
  rawLyrics: string,
  maxLinesPerSlide: 2 | 4 = 4
): ParsedLyricChunk[] {
  const rawLines = rawLyrics.split(/\r?\n/);
  const stanzas: RawStanza[] = [];
  let current: RawStanza | null = null;

  const flushCurrent = () => {
    if (current && current.lines.length > 0) {
      stanzas.push(current);
    }
    current = null;
  };

  for (const line of rawLines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushCurrent();
      continue;
    }

    const bracketMatch = trimmed.match(BRACKET_TAG_RE);
    if (bracketMatch) {
      flushCurrent();
      current = {
        tag: normalizeSectionTag(bracketMatch[1]),
        lines: [],
      };
      continue;
    }

    const inlineMatch = trimmed.match(INLINE_BRACKET_TAG_RE);
    if (inlineMatch) {
      flushCurrent();
      current = {
        tag: normalizeSectionTag(inlineMatch[1]),
        lines: [inlineMatch[2].trim()],
      };
      continue;
    }

    const plainMatch = trimmed.match(PLAIN_SECTION_RE);
    if (plainMatch) {
      flushCurrent();
      current = {
        tag: normalizeSectionTag(plainMatch[1]),
        lines: [],
      };
      continue;
    }

    if (!current) {
      current = { lines: [] };
    }
    current.lines.push(trimmed);
  }
  flushCurrent();

  const chunks: ParsedLyricChunk[] = [];
  let unlabeledCount = 0;

  for (const stanza of stanzas) {
    let baseTag = stanza.tag;
    if (!baseTag) {
      unlabeledCount += 1;
      baseTag = `Verse ${unlabeledCount}`;
    }

    const totalSubChunks = Math.ceil(stanza.lines.length / maxLinesPerSlide);
    for (let i = 0; i < stanza.lines.length; i += maxLinesPerSlide) {
      const slice = stanza.lines.slice(i, i + maxLinesPerSlide);
      const partIndex = Math.floor(i / maxLinesPerSlide);
      const suffix =
        totalSubChunks > 1 ? ` (${String.fromCharCode(65 + partIndex)})` : '';
      chunks.push({
        slideLabel: `${baseTag}${suffix}`,
        sectionTag: baseTag,
        lines: slice,
      });
    }
  }

  return chunks;
}

export function buildWorshipSceneFromLyrics(
  nextCode: string,
  options: ParseLyricsOptions
): ServiceScene {
  const now = Date.now();
  const maxLines = options.maxLinesPerSlide ?? 4;
  const includeTitleSlide = options.includeTitleSlide ?? true;
  const includeSectionTags = options.includeSectionTags ?? true;

  const chunks = parseRawLyricsToChunks(options.rawLyrics, maxLines);
  const derivedTitle =
    options.songTitle.trim() ||
    chunks[0]?.lines[0]?.replace(/[.,;!?]+$/, '') ||
    'New Worship Song';
  const resolvedSubtitle =
    options.subtitle?.trim() || 'Congregational Worship';

  const slides: SlideData[] = [];

  if (includeTitleSlide) {
    slides.push({
      id: `slide-worship-${now}-0`,
      label: 'Song Title',
      layout: 'song-title',
      kicker: 'PRAISE & WORSHIP',
      title: derivedTitle,
      subtitle: resolvedSubtitle,
      backgroundImage: IMAGES.worship,
      ambientIntensity: 'warm',
      transitionDurationSec: 0.8,
    });
  }

  chunks.forEach((chunk, index) => {
    const num = String(index + 1).padStart(2, '0');
    const slideLines = includeSectionTags
      ? [`[${chunk.sectionTag}]`, ...chunk.lines]
      : chunk.lines;

    slides.push({
      id: `slide-worship-${now}-${index + 1}`,
      label: `Lyric ${num} · ${chunk.slideLabel}`,
      layout: 'lyric',
      kicker: chunk.sectionTag,
      title: derivedTitle,
      lines: slideLines,
      backgroundImage: IMAGES.worship,
      ambientIntensity: 'subtle',
      transitionDurationSec: 0.5,
    });
  });

  if (slides.length === 0) {
    slides.push({
      id: `slide-worship-${now}-1`,
      label: 'Lyric 01 · Verse 1',
      layout: 'lyric',
      kicker: 'Verse 1',
      title: derivedTitle,
      lines: ['[Verse 1]', 'Add song lyrics'],
      backgroundImage: IMAGES.worship,
      ambientIntensity: 'subtle',
      transitionDurationSec: 0.5,
    });
  }

  return {
    id: `scene-worship-${now}`,
    code: nextCode,
    name: `Worship — ${derivedTitle}`,
    part: 'part2',
    category: 'Praise & Worship',
    slides,
  };
}
