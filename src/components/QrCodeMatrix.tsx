import React, { useMemo } from 'react';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Generates a deterministic high-contrast 25x25 QR-style matrix SVG
 * with authentic finder patterns, timing tracks, and alignment marker
 * for clean sanctuary projection display.
 */
export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({
  value,
  size = 240,
  className = '',
}) => {
  const modules = useMemo(() => {
    const dim = 25;
    const grid: boolean[][] = Array.from({ length: dim }, () =>
      Array.from({ length: dim }, () => false)
    );

    const drawFinder = (startR: number, startC: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[startR + r][startC + c] = isBorder || isCenter;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, dim - 7);
    drawFinder(dim - 7, 0);

    // Alignment pattern near bottom-right
    for (let r = 16; r <= 20; r++) {
      for (let c = 16; c <= 20; c++) {
        const isEdge = r === 16 || r === 20 || c === 16 || c === 20;
        const isDot = r === 18 && c === 18;
        grid[r][c] = isEdge || isDot;
      }
    }

    // Timing tracks
    for (let i = 8; i < dim - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Deterministic data fill seeded from value string
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const isReserved = (r: number, c: number) => {
      if (r < 8 && c < 8) return true;
      if (r < 8 && c >= dim - 8) return true;
      if (r >= dim - 8 && c < 8) return true;
      if (r === 6 || c === 6) return true;
      if (r >= 16 && r <= 20 && c >= 16 && c <= 20) return true;
      return false;
    };

    let state = hash >>> 0;
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (isReserved(r, c)) continue;
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        grid[r][c] = (state & 0x80000000) !== 0;
      }
    }

    return grid;
  }, [value]);

  const dim = modules.length;

  return (
    <div
      className={`inline-flex items-center justify-center bg-white p-4 rounded-xl shadow-2xl ${className}`}
      aria-label={`Giving QR Code for ${value}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${dim} ${dim}`}
        shapeRendering="crispEdges"
        role="img"
        aria-hidden="true"
      >
        <rect width={dim} height={dim} fill="#FFFFFF" />
        {modules.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect
                key={`${r}-${c}`}
                x={c}
                y={r}
                width={1}
                height={1}
                fill="#0A0B0E"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
