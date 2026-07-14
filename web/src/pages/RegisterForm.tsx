import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./RegisterForm.module.scss";

type Mode = "internal" | "disabled";

export function RegisterForm({ mode = "internal" }: { mode?: Mode }) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (mode === "disabled") {
    return (
      <Card className={styles.card}>
        <p className={styles.bannerError}>Public registration is closed. Join the waitlist on the homepage.</p>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const passwordConfirm = (form.elements.namedItem("passwordConfirm") as HTMLInputElement).value;
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const { token, user } = await api.signUpInternal(email, password, passwordConfirm);
      await setSession(token, user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={styles.card}>
      <form onSubmit={onSubmit} className={styles.form}>
        {error && <p className={styles.bannerError}>{error}</p>}
        <Input name="email" type="email" label="Email" required autoComplete="email" />
        <Input
          name="password"
          type="password"
          label="Password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          name="passwordConfirm"
          type="password"
          label="Confirm password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
