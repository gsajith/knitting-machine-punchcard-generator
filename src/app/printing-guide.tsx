"use client";

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
export function PrintingGuide({ profile }: Props) {
  const web = webThickness(profile);

  return (
    <details className={styles.guide}>
      <summary className={styles.summary}>Printing this card</summary>

      <div className={styles.body}>
        <p className={styles.lede}>
          The card is <strong>{profile.thickness} mm thick — a single layer</strong>.
          The whole part is the first layer, which makes several slicer defaults
          actively harmful. Nothing here is specific to one slicer.
        </p>

        <section className={styles.section}>
          <h3 className={styles.heading}>Turn these off</h3>
          <dl className={styles.settings}>
            <div className={styles.setting}>
              <dt>Elephant-foot compensation</dt>
              <dd>
                Shrinks the first layer&rsquo;s outline inward. On a normal part
                that is cosmetic; here it shrinks <em>every hole</em>. A belt
                hole losing 0.15 mm per side may no longer seat on a drum pin,
                and the card will not feed.
              </dd>
            </div>
            <div className={styles.setting}>
              <dt>XY hole compensation / horizontal expansion</dt>
              <dd>
                Does the same thing deliberately. Set it to zero — the hole sizes
                in the file are already the sizes the machine needs.
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Worth setting</h3>
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
                the web and anchor on both sides — it is just about 30% less
                effective. Worth changing if it is easy to find, not worth
                blocking a print over.
              </dd>
            </div>
            <div className={styles.setting}>
              <dt>Layer height {profile.thickness} mm</dt>
              <dd>
                So the card comes out as exactly one layer. Check the sliced
                preview shows a single layer before printing.
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Check on the first print</h3>
          <ol className={styles.checklist}>
            <li>
              Object measures {profile.cardWidth} mm wide and{" "}
              {profile.thickness} mm thick in the slicer.
            </li>
            <li>It slices to one layer, with the holes actually open.</li>
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
          <h3 className={styles.heading}>What has and hasn&rsquo;t been proven</h3>
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
            If a pattern reads intermittently, round holes are the thing to try.
          </p>
        </section>
      </div>
    </details>
  );
}
