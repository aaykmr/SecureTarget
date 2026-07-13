import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./ResetPasswordForm.module.scss";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const passwordConfirm = (form.elements.namedItem("passwordConfirm") as HTMLInputElement).value;
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await api.resetPassword(token, password);
      navigate("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        setError("Password reset via email is coming soon.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not reset password.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <Card className={styles.card}>
        <p className={styles.bannerError}>Invalid or missing reset link. Request a new one from the sign-in page.</p>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <form onSubmit={onSubmit} className={styles.form}>
        {error ? <p className={styles.bannerError}>{error}</p> : null}
        <Input
          name="password"
          type="password"
          label="New password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          name="passwordConfirm"
          type="password"
          label="Confirm new password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Updating…" : "Reset password"}
        </Button>
      </form>
    </Card>
  );
}
