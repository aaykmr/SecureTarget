"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { registerAction, type ActionResult } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./register-form.module.scss";

const initial: ActionResult = { ok: false, error: "" };

export function RegisterForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(registerAction, initial);

  useEffect(() => {
    if (state.ok) {
      router.push("/login?registered=1");
    }
  }, [state, router]);

  return (
    <Card className={styles.card}>
      <form action={formAction} className={styles.form}>
        {!state.ok && state.error && <p className={styles.bannerError}>{state.error}</p>}
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <Input name="email" type="email" required autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
