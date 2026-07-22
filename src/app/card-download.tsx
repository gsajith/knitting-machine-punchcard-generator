"use client";

import { useState } from "react";

import { demoPattern } from "@/lib/card/demo-pattern";
import { buildCardMesh } from "@/lib/card/mesh";
import { countPunched } from "@/lib/card/pattern";
import { BROTHER_24, cardLength, webThickness } from "@/lib/card/profile";
import { meshTo3mf } from "@/lib/card/threemf";

import styles from "./card-download.module.css";

const ROWS = 40;

export function CardDownload() {
  const [error, setError] = useState<string | null>(null);

  const profile = BROTHER_24;
  const web = webThickness(profile);

  const handleDownload = () => {
    setError(null);
    try {
      const pattern = demoPattern(profile, ROWS);
      const mesh = buildCardMesh(pattern, profile);
      const archive = meshTo3mf(mesh, "punchcard");

      const blob = new Blob([archive], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `punchcard-${ROWS}-rows.3mf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build the card.");
    }
  };

  return (
    <div className={styles.panel}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Machine</dt>
          <dd>{profile.name}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Card</dt>
          <dd>
            {profile.columns} stitches &times; {ROWS} rows
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Size</dt>
          <dd>
            {profile.cardWidth} &times; {cardLength(profile, ROWS)} &times;{" "}
            {profile.thickness} mm
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Punched</dt>
          <dd>{countPunched(demoPattern(profile, ROWS))} stitches</dd>
        </div>
        <div className={styles.fact}>
          <dt>Web</dt>
          <dd>
            {web.horizontal} mm across, {web.vertical} mm along
          </dd>
        </div>
      </dl>

      <button type="button" className={styles.button} onClick={handleDownload}>
        Download 3MF
      </button>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <p className={styles.note}>
        Includes belt holes on every row and loop holes at both ends. The
        pattern itself is still hardcoded until the editor is built.
      </p>
    </div>
  );
}
