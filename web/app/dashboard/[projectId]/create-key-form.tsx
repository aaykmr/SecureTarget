"use client";

import { useActionState } from "react";
import { createApiKeyAction, type ActionResult } from "@/app/dashboard/actions";

const initial: ActionResult = { ok: false, error: "" };

export function CreateApiKeyForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initial);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Generating…" : "Generate API key"}
        </button>
      </form>
      {!state.ok && state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state.ok && state.apiKey ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">{state.message ?? "Copy this key now."}</p>
          <code className="mt-2 block break-all font-mono text-xs">{state.apiKey}</code>
        </div>
      ) : null}
    </div>
  );
}
