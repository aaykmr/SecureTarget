"use client";

import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useActionState, useCallback } from "react";
import { toast } from "react-toastify";
import { createApiKeyAction, type ActionResult } from "@/app/dashboard/actions";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";
import styles from "./create-key-form.module.scss";

const initial: ActionResult = { ok: false, error: "" };

export function CreateApiKeyForm({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initial);

  const copyApiKey = useCallback(async () => {
    if (!state.ok) return;
    const key = state.apiKey;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Copied API key");
    } catch {
      toast.error("Could not copy");
    }
  }, [state]);

  return (
    <div className={styles.root}>
      <form action={formAction} className={styles.inlineForm}>
        <input type="hidden" name="projectId" value={projectId} />
        <Button type="submit" disabled={pending || disabled} variant="primary">
          {pending ? "Generating…" : disabled ? "Subscription required" : "Generate API key"}
        </Button>
      </form>
      {!state.ok && state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.ok && state.apiKey ? (
        <div className={styles.successBox}>
          <p className={styles.successLead}>{state.message ?? "Copy this key now."}</p>
          <button
            type="button"
            className={styles.keyCopyRow}
            onClick={() => void copyApiKey()}
            aria-label="Copy API key to clipboard"
          >
            <code className={styles.keyCode}>{state.apiKey}</code>
            <HugeIcon icon={Copy01Icon} size={16} className={styles.copyIcon} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
