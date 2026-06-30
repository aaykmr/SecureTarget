import { Delete02Icon } from "@hugeicons/core-free-icons";
import { revokeApiKeyAction } from "@/app/dashboard/actions";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./revoke-key-form.module.scss";
import { Button } from "@/components/ui/button";
export function RevokeKeyForm({ projectId, keyId }: { projectId: string; keyId: string }) {
  return (
    <form action={revokeApiKeyAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="keyId" value={keyId} />
      <Button type="submit" variant="secondary" className={styles.revoke}>
        <HugeIcon icon={Delete02Icon} size={16} />
      </Button>
    </form>
  );
}
