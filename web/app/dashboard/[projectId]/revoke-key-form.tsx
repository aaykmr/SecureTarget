import { revokeApiKeyAction } from "@/app/dashboard/actions";

export function RevokeKeyForm({ projectId, keyId }: { projectId: string; keyId: string }) {
  return (
    <form action={revokeApiKeyAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="keyId" value={keyId} />
      <button
        type="submit"
        className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      >
        Revoke
      </button>
    </form>
  );
}
