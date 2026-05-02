"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./login-form.module.scss";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const res = await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className={styles.card}>
      <form onSubmit={onSubmit} className={styles.form}>
        {registered && (
          <p className={styles.bannerSuccess}>Account created. Sign in below.</p>
        )}
        {error && <p className={styles.bannerError}>{error}</p>}
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <Input name="email" type="email" required autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <Input name="password" type="password" required autoComplete="current-password" />
        </label>
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
