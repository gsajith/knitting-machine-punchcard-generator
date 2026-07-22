"use client";

import { memo } from "react";

import { webThickness, type CardProfile } from "@/lib/card/profile";

import styles from "./printing-guide.module.css";

interface Props {
  profile: CardProfile;
}

/**
 * Print settings, explained rather than listed.
 *
 * Exports carry geometry only and no print profile (ADR-0007), so this panel is
 * the only thing standing between a correct file and a ruined print. A profile
 * would be bound to one printer, nozzle and filament; this survives being read
 * by someone on any machine.
 */
function PrintingGuideContent({ profile }: Props) {
  const web = webThickness(profile);

  return (
    <details className={styles.guide}>
      <summary className={styles.summary}>
        <h3 className={styles.summaryHeading}>Printing this card</h3>
      </summary>

      <div className={styles.body}>
        <p className={styles.lede}>
          The card is <strong>{profile.thickness} mm thick — a single layer</strong>.
          The whole part is the first layer, which makes several slicer defaults
          actively harmful. Nothing here is specific to one slicer.
        </p>

        <section className={styles.section}>
          <h4 className={styles.heading}>Turn these off</h4>
          <dl className={styles.settings}>
            <div className={styles.setting}>
              <dt>Elephant-foot compensation</dt>
              <dd>
                Pulls the first layer&rsquo;s <em>solid</em> outline inward to
                cancel out squish. On a normal part that only trims the bottom
                edge. Here the whole card is that layer, so it eats material
                everywhere: every hole grows and every web between holes gets
                thinner. The {web.horizontal} mm web between neighbouring
                stitches — the axis most likely to tear — drops to roughly{" "}
                {(web.horizontal - 2 * 0.15).toFixed(2)} mm at a typical
                0.15 mm setting, and belt holes grow loose on the drum pins.
              </dd>
            </div>
            <div className={styles.setting}>
              <dt>XY size / hole compensation</dt>
              <dd>
                Adjusts hole and perimeter sizes deliberately. Slicers name this
                differently — XY size compensation, X-Y hole compensation, hole
                horizontal expansion — and they do not all apply it in the same
                direction, so do not assume a positive value is safe. Whatever
                yours is called, set it to zero: the sizes in the file are
                already the sizes the machine needs.
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>Worth setting</h4>
          <dl className={styles.settings}>
            <div className={styles.setting}>
              <dt>Material: PETG or PCTG, not PLA</dt>
              <dd>
                The material between two side-by-side holes is{" "}
                {web.horizontal} mm wide and one layer thick. PLA is brittle at
                that size; PETG and PCTG tear far less readily at identical
                geometry. This is the single biggest lever on whether the card
                survives use.
              </dd>
            </div>
            <div className={styles.setting}>
              <dt>Line direction along the card&rsquo;s length</dt>
              <dd>
                The card is pulled lengthways as it wraps the drum. Lines running
                that way make each web a continuous strand rather than a bond
                between strands. A 45&deg; default still works — strands cross
                the web and anchor in solid material on both sides — it just
                carries the load at an angle instead of along it. Worth changing
                if it is easy to find, not worth blocking a print over.
              </dd>
            </div>
            <div className={styles.setting}>
              <dt>Initial layer height {profile.thickness} mm</dt>
              <dd>
                The first layer, specifically — not just the layer height. The
                card <em>is</em> the first layer, so that setting alone decides
                its thickness. Profiles commonly ship a thicker first layer for
                bed adhesion; a 0.3 mm one would give you a card half again as
                thick as it should be.
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>Check on the first print</h4>
          <ol className={styles.checklist}>
            <li>
              Object measures {profile.cardWidth} mm wide and{" "}
              {profile.thickness} mm thick in the slicer.
            </li>
            <li>
              It slices to exactly one layer, and the slicer&rsquo;s first-layer
              height reads {profile.thickness} mm.
            </li>
            <li>The holes are actually open in the sliced preview, not filled in.</li>
            <li>The drum pins seat in the belt holes — the outer-but-one column.</li>
            <li>
              The card feeds and advances a row at a time without slipping.
            </li>
            <li>Your clips fit the loop holes along the outer edge.</li>
            <li>
              The pattern reads the way you drew it. If it comes out mirrored or
              upside down, use the orientation toggles above rather than
              redrawing.
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>What has and hasn&rsquo;t been proven</h4>
          <p className={styles.note}>
            <strong>Confirmed on a real machine:</strong> a{" "}
            {profile.thickness} mm card at {profile.cardWidth} mm wide feeds
            correctly, the drum pins seat in the belt holes, and standard
            punchcard clips fit the loop holes.
          </p>
          <p className={styles.note}>
            <strong>Not yet confirmed:</strong> that the elongated pattern holes
            read as reliably as round ones — that is an inference from the belt
            hole size, not a measurement. Also untested: how well the webs
            survive repeated use, and whether a split card&rsquo;s seam holds.
            The {profile.minRows}-row minimum is also a working figure rather
            than a measured one. If a pattern reads intermittently, the round-hole
            geometry is the thing to try — it exists in the code but is not yet
            selectable here.
          </p>
        </section>
      </div>
    </details>
  );
}

/**
 * Memoised because it lives inside the editor, which re-renders on every cell
 * painted during a drag. This subtree is static apart from a few profile
 * numbers, and the profile is a module constant, so it renders once.
 */
export const PrintingGuide = memo(PrintingGuideContent);
