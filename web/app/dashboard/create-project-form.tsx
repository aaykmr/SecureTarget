"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import styles from "./create-project-form.module.scss";

const initial: ActionResult = { ok: false, error: "" };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initial);

  return (
    <Card>
      <form action={formAction} className={styles.form}>
        <h2 className={styles.title}>New project</h2>
        {!state.ok && state.error ? <p className={styles.error}>{state.error}</p> : null}
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <Input name="name" required placeholder="My website" />
        </label>
        <Button type="submit" disabled={pending} variant="primary" alignSelfStart>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </Card>
  );
}
