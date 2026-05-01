import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getProjectForUser, listApiKeysForProject } from "@/lib/repos";
import { CreateApiKeyForm } from "./create-key-form";
import { IntegrationSnippets } from "./integration-snippets";
import { RevokeKeyForm } from "./revoke-key-form";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) {
    notFound();
  }
  const keys = listApiKeysForProject(db, projectId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Back to projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
        <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">companyId: {project.company_id}</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">API keys</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use the key in the <code className="font-mono text-xs">x-api-key</code> header. The ingest server maps it to this project&apos;s{" "}
          <code className="font-mono text-xs">companyId</code>.
        </p>
        <div className="mt-4">
          <CreateApiKeyForm projectId={project.id} />
        </div>
        <ul className="mt-6 flex flex-col gap-2">
          {keys.length === 0 ? (
            <li className="text-sm text-zinc-500">No keys yet.</li>
          ) : (
            keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{k.key_prefix}…</span>
                  <span className="text-xs text-zinc-500">
                    {k.revoked_at ? `Revoked ${k.revoked_at}` : `Created ${k.created_at}`}
                  </span>
                </div>
                {!k.revoked_at ? <RevokeKeyForm projectId={project.id} keyId={k.id} /> : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Integration</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Point the Web SDK at your ingest server. Set <code className="font-mono text-xs">NEXT_PUBLIC_INGEST_URL</code> in this app to
          match where you run the backend.
        </p>
        <div className="mt-4">
          <IntegrationSnippets companyId={project.company_id} />
        </div>
      </section>
    </div>
  );
}
