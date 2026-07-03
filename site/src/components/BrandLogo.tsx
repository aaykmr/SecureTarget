import { useState } from "react";
import styles from "./BrandLogo.module.scss";

const LOGO_SOURCES = ["/logo.webp", "/logo.svg", "/logo.png"] as const;

export function BrandLogo({
  showWordmark = true,
  markClassName,
  wordmarkClassName,
}: {
  showWordmark?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const useFallback = sourceIndex >= LOGO_SOURCES.length;
  const src = LOGO_SOURCES[sourceIndex];

  function onLogoError() {
    setSourceIndex((i) => i + 1);
  }

  return (
    <>
      {useFallback ? (
        <span className={`${styles.logoMark} ${markClassName ?? ""}`} aria-hidden>
          T
        </span>
      ) : (
        <img
          src={src}
          alt=""
          className={`${styles.logoImg} ${markClassName ?? ""}`}
          onError={onLogoError}
        />
      )}
      {showWordmark ? (
        <span className={`${styles.logoText} ${wordmarkClassName ?? ""}`}>TrustTargets</span>
      ) : null}
    </>
  );
}
