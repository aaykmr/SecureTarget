"use client";

import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { HugeIcon } from "@/components/huge-icon";
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
      <HugeIcon icon={isDark ? Sun01Icon : Moon02Icon} size={20} className={styles.icon} />
    </button>
  );
}
