"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/dashboard/actions";

const initial: ActionResult = { ok: false, error: "" };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">New project</h2>
      {!state.ok && state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Name</span>
        <input
          name="name"
          required
          placeholder="My website"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
