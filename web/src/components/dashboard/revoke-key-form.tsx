import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";
import styles from "./revoke-key-form.module.scss";

export function RevokeKeyForm({
  projectId,
  keyId,
  onRevoked,
}: {
  projectId: string;
  keyId: string;
  onRevoked?: () => void;
}) {
  const { token } = useAuth();
  const [pending, setPending] = useState(false);

  async function onRevoke() {
    if (!token || pending) return;
    setPending(true);
    try {
      await api.revokeApiKey(token, projectId, keyId);
      onRevoked?.();
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : "Revoke failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className={styles.revoke} disabled={pending} onClick={() => void onRevoke()}>
      <HugeIcon icon={Delete02Icon} size={16} />
    </Button>
  );
}
