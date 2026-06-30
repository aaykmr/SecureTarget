"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { signOut } from "next-auth/react";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./sign-out-button.module.scss";

export function SignOutButton() {
  return (
    <button type="button" className={styles.button} onClick={() => signOut({ callbackUrl: "/login" })}>
      <HugeIcon icon={Logout01Icon} size={18} className={styles.icon} />
      <span>Sign out</span>
    </button>
  );
}
