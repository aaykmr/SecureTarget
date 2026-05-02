"use client";

import { signOut } from "next-auth/react";
import styles from "./sign-out-button.module.scss";

export function SignOutButton() {
  return (
    <button type="button" className={styles.button} onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </button>
  );
}
