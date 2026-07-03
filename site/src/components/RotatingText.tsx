import { useEffect, useState } from "react";
import styles from "./RotatingText.module.scss";

export function RotatingText({
  words,
  intervalMs = 2800,
  className,
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimating(true);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setAnimating(false);
      }, 320);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span className={`${styles.root} ${className ?? ""}`} aria-live="polite">
      <span className={`${styles.word} ${animating ? styles.wordOut : styles.wordIn}`}>{words[index]}</span>
    </span>
  );
}
