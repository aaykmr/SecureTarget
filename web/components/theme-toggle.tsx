"use client";

import DarkMode from "@mui/icons-material/DarkMode";
import LightMode from "@mui/icons-material/LightMode";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import styles from "./theme-toggle.module.scss";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={styles.placeholder} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={styles.button}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <LightMode className={styles.icon} /> : <DarkMode className={styles.icon} />}
    </button>
  );
}
