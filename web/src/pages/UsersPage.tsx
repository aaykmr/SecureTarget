import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  ORG_TAB_KEYS,
  ORG_TAB_LABELS,
  type OrgMember,
  type OrgTabKey,
  type OrgTabPermissions,
  type PendingInvite,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./UsersPage.module.scss";

export function UsersPage() {
  const { token, currentOrganization, isOrgOwner, isGlobalAdmin } = useAuth();
  const orgId = currentOrganization?.id ?? "";
  const canManage = isOrgOwner || isGlobalAdmin;
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

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
    if (!token || !orgId || !canManage) return;
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

  async function togglePermission(member: OrgMember, tab: OrgTabKey, next: boolean) {
    if (!token || !orgId || !canManage || member.role === "owner") return;
    const previous = member.permissions;
    const optimistic: OrgTabPermissions = { ...previous, [tab]: next };
    setMembers((list) =>
      list.map((m) => (m.user_id === member.user_id ? { ...m, permissions: optimistic } : m)),
    );
    setSavingUserId(member.user_id);
    try {
      const { member: updated } = await api.updateMemberPermissions(token, orgId, member.user_id, {
        [tab]: next,
      });
      setMembers((list) => list.map((m) => (m.user_id === updated.user_id ? updated : m)));
    } catch (err) {
      setMembers((list) =>
        list.map((m) => (m.user_id === member.user_id ? { ...m, permissions: previous } : m)),
      );
      setError(err instanceof ApiError ? err.message : "Could not update permissions.");
    } finally {
      setSavingUserId(null);
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
            password via the email link. Expand a member to manage tab access.
          </p>
        }
      />

      {!currentOrganization ? (
        <DashboardPanel title="Members">
          <p className={styles.empty}>Select an organization in the sidebar to manage users.</p>
        </DashboardPanel>
      ) : (
        <>
          {canManage ? (
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
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : null}

          <DashboardPanel title="Members">
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : members.length === 0 ? (
              <p className={styles.empty}>No members yet.</p>
            ) : (
              <ul className={styles.accordion}>
                {members.map((m) => {
                  const expanded = expandedUserId === m.user_id;
                  const editable = canManage && m.role === "member";
                  return (
                    <li key={m.user_id} className={styles.accordionItem}>
                      <button
                        type="button"
                        className={styles.accordionTrigger}
                        aria-expanded={expanded}
                        onClick={() => setExpandedUserId(expanded ? null : m.user_id)}
                      >
                        <span className={styles.name}>{m.email}</span>
                        <span className={styles.meta}>
                          {m.role}
                          {savingUserId === m.user_id ? " · saving…" : ""}
                        </span>
                      </button>
                      {expanded ? (
                        <div className={styles.accordionPanel}>
                          {m.role === "owner" ? (
                            <p className={styles.hint}>Owners always have access to every tab.</p>
                          ) : !canManage ? (
                            <p className={styles.hint}>Only organization owners can edit permissions.</p>
                          ) : null}
                          <div className={styles.permGrid}>
                            {ORG_TAB_KEYS.map((tab) => (
                              <label key={tab} className={styles.permItem}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(m.permissions[tab])}
                                  disabled={!editable || savingUserId === m.user_id}
                                  onChange={(e) => void togglePermission(m, tab, e.target.checked)}
                                />
                                <span>{ORG_TAB_LABELS[tab]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
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
