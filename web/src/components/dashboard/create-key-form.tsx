import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";
import styles from "./create-key-form.module.scss";

export function CreateApiKeyForm({
  projectId,
  disabled,
  hasActiveKey,
  onChanged,
}: {
  projectId: string;
  disabled?: boolean;
  hasActiveKey?: boolean;
  onChanged?: () => void;
}) {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fullKey, setFullKey] = useState<string | null>(null);

  const copyApiKey = useCallback(async () => {
    if (!fullKey) return;
    try {
      await navigator.clipboard.writeText(fullKey);
      toast.success("Copied API key");
    } catch {
      toast.error("Could not copy");
    }
  }, [fullKey]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || disabled) return;
    setError(null);
    setPending(true);
    setFullKey(null);
    try {
      const { fullKey: key } = await api.createApiKey(token, projectId);
      setFullKey(key);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create API key.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <form onSubmit={onSubmit} className={styles.inlineForm}>
        <Button type="submit" disabled={pending || disabled} variant="primary" size="sm">
          {pending ? "Generating…" : disabled ? "Subscription required" : hasActiveKey ? "Rotate API key" : "Generate API key"}
        </Button>
      </form>
      {error ? <p className={styles.error}>{error}</p> : null}
      {fullKey ? (
        <div className={styles.successBox}>
          <p className={styles.successLead}>Copy this key now — it won&apos;t be shown again.</p>
          <button
            type="button"
            className={styles.keyCopyRow}
            onClick={() => void copyApiKey()}
            aria-label="Copy API key to clipboard"
          >
            <code className={styles.keyCode}>{fullKey}</code>
            <HugeIcon icon={Copy01Icon} size={16} className={styles.copyIcon} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
