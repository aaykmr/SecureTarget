import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProjectsForUser } from "@/lib/repos";
import { CreateProjectForm } from "./create-project-form";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  const db = getDb();
  const projects = listProjectsForUser(db, userId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Projects</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Each project has a <code className="font-mono text-xs">companyId</code> used in the SDK. Create an API key on the project page.
        </p>
      </div>
      <CreateProjectForm />
      <div>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Your projects</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No projects yet. Create one above.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/${p.id}`}
                  className="flex flex-col rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{p.company_id}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
