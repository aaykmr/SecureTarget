import { useState } from "react";
import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./ForgotPasswordForm.module.scss";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={styles.card}>
      <form onSubmit={onSubmit} className={styles.form}>
        {success ? (
          <p className={styles.bannerSuccess}>
            If an account exists for that email, we&apos;ll send a reset link.
          </p>
        ) : null}
        {error ? <p className={styles.bannerError}>{error}</p> : null}
        <Input name="email" type="email" label="Email" required autoComplete="email" disabled={success} />
        <Button type="submit" disabled={pending || success} variant="primary" fullWidth>
          {pending ? "Sending…" : success ? "Email sent" : "Send reset link"}
        </Button>
      </form>
    </Card>
  );
}
