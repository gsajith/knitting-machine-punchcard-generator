"use client";

import { isPunched, type Pattern } from "@/lib/card/pattern";
import {
  loopHoleBoundaries,
  rowBoundary,
  rowCentre,
  stitchCentreX,
  type CardProfile,
} from "@/lib/card/profile";

import styles from "./card-preview.module.css";

interface Props {
  pattern: Pattern;
  profile: CardProfile;
  /** Row boundaries where the card is cut into pieces. */
  seamBoundaries?: number[];
}

/**
 * The card as it will actually be punched — all three hole types, drawn to
 * scale in millimetres. Read-only: the motif is the document (ADR-0004).
 */
export function CardPreview({ pattern, profile, seamBoundaries = [] }: Props) {
  const width = profile.cardWidth;
  const height = pattern.rows * profile.rowPitch;
  const half = { x: width / 2, y: height / 2 };

  // SVG y grows downward; the card's y grows upward. Flip once, here.
  const toY = (y: number) => half.y - y;

  const patternHoles: React.ReactElement[] = [];
  for (let row = 0; row < pattern.rows; row++) {
    for (let column = 0; column < profile.columns; column++) {
      if (!isPunched(pattern, row, column)) continue;
      patternHoles.push(
        <ellipse
          key={`p-${row}-${column}`}
          cx={half.x + stitchCentreX(profile, column)}
          cy={toY(rowCentre(profile, row, pattern.rows))}
          rx={profile.patternHole.width / 2}
          ry={profile.patternHole.height / 2}
          className={styles.patternHole}
        />,
      );
    }
  }

  const beltHoles: React.ReactElement[] = [];
  for (let row = 0; row < pattern.rows; row++) {
    for (const side of [-1, 1]) {
      beltHoles.push(
        <circle
          key={`b-${row}-${side}`}
          cx={half.x + side * profile.beltHoleOffsetX}
          cy={toY(rowCentre(profile, row, pattern.rows))}
          r={profile.beltHole.width / 2}
          className={styles.beltHole}
        />,
      );
    }
  }

  const loopHoles: React.ReactElement[] = [];
  for (const boundary of loopHoleBoundaries(pattern.rows)) {
    for (const side of [-1, 1]) {
      loopHoles.push(
        <circle
          key={`l-${boundary}-${side}`}
          cx={half.x + side * profile.loopHoleOffsetX}
          cy={toY(rowBoundary(profile, boundary, pattern.rows))}
          r={profile.loopHole.width / 2}
          className={styles.loopHole}
        />,
      );
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        <svg
          className={styles.card}
          viewBox={`0 0 ${width} ${height}`}
          style={{ aspectRatio: `${width} / ${height}` }}
          role="img"
          aria-label={`Punchcard preview, ${profile.columns} stitches by ${pattern.rows} rows`}
        >
          <rect x={0} y={0} width={width} height={height} className={styles.body} />
          {patternHoles}
          {beltHoles}
          {loopHoles}

          {seamBoundaries.map((boundary) => (
            <line
              key={`seam-${boundary}`}
              x1={0}
              x2={width}
              y1={toY(rowBoundary(profile, boundary, pattern.rows))}
              y2={toY(rowBoundary(profile, boundary, pattern.rows))}
              className={styles.seam}
            />
          ))}

          <g className={styles.marks}>
            <text x={2} y={height - 1.5} className={styles.rowLabel}>
              row 1
            </text>
          </g>
        </svg>
      </div>

      <div className={styles.legend}>
        <span className={styles.key}>
          <span className={`${styles.swatch} ${styles.swatchPattern}`} aria-hidden="true" />{" "}
          filled — pattern
        </span>
        <span className={styles.key}>
          <span className={`${styles.swatch} ${styles.swatchBelt}`} aria-hidden="true" />{" "}
          outlined — belt (drive)
        </span>
        <span className={styles.key}>
          <span className={`${styles.swatch} ${styles.swatchLoop}`} aria-hidden="true" />{" "}
          dashed — loop (clips)
        </span>
        <span className={styles.feed}>↑ feeds this way</span>
      </div>
    </div>
  );
}
