import { revokeApiKeyAction } from "@/app/dashboard/actions";
import styles from "./revoke-key-form.module.scss";
import { Button } from "@/components/ui/button";
import DeleteIcon from "@mui/icons-material/Delete";
export function RevokeKeyForm({ projectId, keyId }: { projectId: string; keyId: string }) {
  return (
    <form action={revokeApiKeyAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="keyId" value={keyId} />
      <Button type="submit" variant="secondary" className={styles.revoke}>
        <DeleteIcon fontSize="small" aria-hidden />
      </Button>
    </form>
  );
}
