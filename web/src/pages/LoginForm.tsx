import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./LoginForm.module.scss";

export function LoginForm({ registered, reset }: { registered?: boolean; reset?: boolean }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid email or password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={styles.card}>
      <form onSubmit={onSubmit} className={styles.form}>
        {registered && <p className={styles.bannerSuccess}>Account created. Sign in below.</p>}
        {reset && <p className={styles.bannerSuccess}>Password updated. Sign in with your new password.</p>}
        {error && <p className={styles.bannerError}>{error}</p>}
        <Input name="email" type="email" label="Email" required autoComplete="email" />
        <Input
          name="password"
          type="password"
          label="Password"
          required
          autoComplete="current-password"
        />
        <p className={styles.forgotRow}>
          <Link to="/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>
        </p>
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
