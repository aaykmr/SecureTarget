import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./RegisterForm.module.scss";

export function RegisterForm() {
  const navigate = useNavigate();
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
      await api.register(email, password);
      navigate("/login?registered=1");
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
        <Button type="submit" disabled={pending} variant="primary" fullWidth>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
