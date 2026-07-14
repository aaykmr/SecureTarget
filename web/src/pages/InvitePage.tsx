import { useEffect, useState } from "react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./RegisterPage.module.scss";
import formStyles from "./RegisterForm.module.scss";

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [preview, setPreview] = useState<{ email: string; organizationName: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing invite token.");
      return;
    }
    api
      .getInvite(token)
      .then(({ invite }) => setPreview({ email: invite.email, organizationName: invite.organizationName }))
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Invite not found or expired.");
      });
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const { token: jwt, user } = await api.acceptInvite(token, password, confirmPassword);
      await setSession(jwt, user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        EventIQN
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Accept invite</h1>
        <p className={styles.subtitle}>
          {preview
            ? `Join ${preview.organizationName} as ${preview.email}.`
            : "Set a password to join your organization."}
        </p>
      </div>
      <Card className={formStyles.card}>
        {loadError ? (
          <p className={formStyles.bannerError}>{loadError}</p>
        ) : (
          <form onSubmit={onSubmit} className={formStyles.form}>
            {error && <p className={formStyles.bannerError}>{error}</p>}
            <Input
              name="password"
              type="password"
              label="Password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Input
              name="confirmPassword"
              type="password"
              label="Confirm password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={pending || !preview} variant="primary" fullWidth>
              {pending ? "Joining…" : "Set password & join"}
            </Button>
          </form>
        )}
      </Card>
      <p className={styles.footer}>
        Already have an account?{" "}
        <Link to="/login" className={styles.footerLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
