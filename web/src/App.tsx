import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireProjectTab, RequireTab } from "@/components/require-tab";
import { HomePage } from "@/pages/HomePage";

const AppSettingsPage = lazy(() =>
  import("@/pages/AppSettingsPage").then((m) => ({ default: m.AppSettingsPage })),
);
const AttributionPage = lazy(() =>
  import("@/pages/AttributionPage").then((m) => ({ default: m.AttributionPage })),
);
const CampaignsPage = lazy(() =>
  import("@/pages/CampaignsPage").then((m) => ({ default: m.CampaignsPage })),
);
const DashboardHomeRedirect = lazy(() =>
  import("@/pages/DashboardHomeRedirect").then((m) => ({ default: m.DashboardHomeRedirect })),
);
const DashboardLayout = lazy(() =>
  import("@/pages/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);
const EventsPage = lazy(() => import("@/pages/EventsPage").then((m) => ({ default: m.EventsPage })));
const ForgotPasswordPage = lazy(() =>
  import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const InquiriesPage = lazy(() =>
  import("@/pages/InquiriesPage").then((m) => ({ default: m.InquiriesPage })),
);
const InvitePage = lazy(() => import("@/pages/InvitePage").then((m) => ({ default: m.InvitePage })));
const LinksIndexRedirect = lazy(() =>
  import("@/pages/LinksLayout").then((m) => ({ default: m.LinksIndexRedirect })),
);
const LinksLayout = lazy(() => import("@/pages/LinksLayout").then((m) => ({ default: m.LinksLayout })));
const TypedLinkTypePage = lazy(() =>
  import("@/pages/TypedLinkTypePage").then((m) => ({ default: m.TypedLinkTypePage })),
);
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const ProjectPage = lazy(() => import("@/pages/ProjectPage").then((m) => ({ default: m.ProjectPage })));
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const SignUpInternalPage = lazy(() =>
  import("@/pages/SignUpInternalPage").then((m) => ({ default: m.SignUpInternalPage })),
);
const SkanPage = lazy(() => import("@/pages/SkanPage").then((m) => ({ default: m.SkanPage })));
const TermsPage = lazy(() => import("@/pages/TermsPage").then((m) => ({ default: m.TermsPage })));
const UsersPage = lazy(() => import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })));

function RouteFallback() {
  return <p style={{ margin: "2rem", color: "#64748b" }}>Loading…</p>;
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/#waitlist" replace />} />
        <Route path="/sign-up-internal" element={<SignUpInternalPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHomeRedirect />} />
          <Route path="organizations" element={<Navigate to="/dashboard" replace />} />
          <Route path="inquiries" element={<InquiriesPage />} />
          <Route element={<RequireTab tab="users" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="get_started" />}>
            <Route path=":projectId" element={<ProjectPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="campaigns" />}>
            <Route path=":projectId/campaigns" element={<CampaignsPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="attribution" />}>
            <Route path=":projectId/attribution" element={<AttributionPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="links" />}>
            <Route path=":projectId/links" element={<LinksLayout />}>
              <Route index element={<LinksIndexRedirect />} />
              <Route path=":linkTypeSegment" element={<TypedLinkTypePage />} />
            </Route>
          </Route>
          <Route element={<RequireProjectTab tab="events" />}>
            <Route path=":projectId/events" element={<EventsPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="skan" />}>
            <Route path=":projectId/skan" element={<SkanPage />} />
          </Route>
          <Route element={<RequireProjectTab tab="app_settings" />}>
            <Route path=":projectId/settings/apps" element={<AppSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
