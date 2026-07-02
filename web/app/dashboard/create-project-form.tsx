"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/dashboard/actions";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./create-project-form.module.scss";

const initial: ActionResult = { ok: false, error: "" };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initial);

  return (
    <DashboardPanel title="New project">
      <form action={formAction} className={styles.form}>
        {!state.ok && state.error ? <p className={styles.error}>{state.error}</p> : null}
        <Input name="name" label="Name" required placeholder="My website" />
        <Button type="submit" disabled={pending} size="sm" alignSelfStart>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </DashboardPanel>
  );
}
