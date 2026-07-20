import { Navigate, Route, Routes } from "react-router-dom";
import { RequireProjectTab, RequireTab } from "@/components/require-tab";
import { AppSettingsPage } from "@/pages/AppSettingsPage";
import { AttributionPage } from "@/pages/AttributionPage";
import { CampaignsPage } from "@/pages/CampaignsPage";
import { DashboardHomeRedirect } from "@/pages/DashboardHomeRedirect";
import { DashboardLayout } from "@/pages/DashboardLayout";
import { EventsPage } from "@/pages/EventsPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { InquiriesPage } from "@/pages/InquiriesPage";
import { InvitePage } from "@/pages/InvitePage";
import { LinksIndexRedirect, LinksLayout } from "@/pages/LinksLayout";
import { TypedLinkTypePage } from "@/pages/TypedLinkTypePage";
import { LoginPage } from "@/pages/LoginPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { ProjectPage } from "@/pages/ProjectPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SignUpInternalPage } from "@/pages/SignUpInternalPage";
import { SkanPage } from "@/pages/SkanPage";
import { TermsPage } from "@/pages/TermsPage";
import { UsersPage } from "@/pages/UsersPage";

export function App() {
  return (
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
  );
}
