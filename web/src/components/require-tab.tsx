import { Navigate, Outlet, useParams } from "react-router-dom";
import type { OrgTabKey } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

export function RequireTab({ tab }: { tab: OrgTabKey }) {
  const { loading, can } = useAuth();
  if (loading) return null;
  if (!can(tab)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequireProjectTab({ tab }: { tab: OrgTabKey }) {
  const { projectId } = useParams();
  const { loading, can, currentProjectId } = useAuth();
  if (loading) return null;
  if (!can(tab)) return <Navigate to="/dashboard" replace />;
  if (!currentProjectId && !projectId) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
