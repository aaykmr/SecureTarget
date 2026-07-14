import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type OrgMember, type PendingInvite } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./UsersPage.module.scss";

export function UsersPage() {
  const { token, currentOrganization } = useAuth();
  const orgId = currentOrganization?.id ?? "";
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrgMembers(token, orgId);
      setMembers(data.members);
      setPendingInvites(data.pendingInvites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load members.");
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !orgId) return;
    setPending(true);
    setError(null);
    setInviteMessage(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    try {
      const result = await api.inviteToOrganization(token, orgId, email);
      form.reset();
      if (result.emailSent) {
        setInviteMessage(`Invite sent to ${result.invite.email}.`);
      } else {
        setInviteMessage(
          `Invite created${result.emailError ? ` (email: ${result.emailError})` : ""}. Copy link: ${result.inviteUrl}`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Users"
        description={
          <p>
            Invite teammates to{" "}
            {currentOrganization ? <strong>{currentOrganization.name}</strong> : "an organization"}. They set a
            password via the email link.
          </p>
        }
      />

      {!currentOrganization ? (
        <DashboardPanel title="Members">
          <p className={styles.empty}>Select an organization in the sidebar to manage users.</p>
        </DashboardPanel>
      ) : (
        <>
          <DashboardPanel title="Invite">
            <form onSubmit={onInvite} className={styles.form}>
              {error ? <p className={styles.error}>{error}</p> : null}
              {inviteMessage ? <p className={styles.success}>{inviteMessage}</p> : null}
              <Input name="email" type="email" label="Work email" required placeholder="name@company.com" />
              <Button type="submit" disabled={pending || !orgId} size="sm" alignSelfStart>
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </DashboardPanel>

          <DashboardPanel title="Members">
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : members.length === 0 ? (
              <p className={styles.empty}>No members yet.</p>
            ) : (
              <ul className={styles.list}>
                {members.map((m) => (
                  <li key={m.user_id} className={styles.row}>
                    <span className={styles.name}>{m.email}</span>
                    <span className={styles.meta}>{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>

          {pendingInvites.length > 0 ? (
            <DashboardPanel title="Pending invites">
              <ul className={styles.list}>
                {pendingInvites.map((i) => (
                  <li key={i.id} className={styles.row}>
                    <span className={styles.name}>{i.email}</span>
                    <span className={styles.meta}>Expires {new Date(i.expiresAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </DashboardPanel>
          ) : null}
        </>
      )}
    </div>
  );
}
