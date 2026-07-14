import { Navigate, Route, Routes } from "react-router-dom";
import { AppSettingsPage } from "@/pages/AppSettingsPage";
import { AttributionPage } from "@/pages/AttributionPage";
import { CampaignsPage } from "@/pages/CampaignsPage";
import { DashboardLayout } from "@/pages/DashboardLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { EventsPage } from "@/pages/EventsPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { InquiriesPage } from "@/pages/InquiriesPage";
import { InvitePage } from "@/pages/InvitePage";
import { LinksPage } from "@/pages/LinksPage";
import { LoginPage } from "@/pages/LoginPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
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
        <Route index element={<DashboardPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="inquiries" element={<InquiriesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path=":projectId" element={<ProjectPage />} />
        <Route path=":projectId/campaigns" element={<CampaignsPage />} />
        <Route path=":projectId/attribution" element={<AttributionPage />} />
        <Route path=":projectId/links" element={<LinksPage />} />
        <Route path=":projectId/events" element={<EventsPage />} />
        <Route path=":projectId/skan" element={<SkanPage />} />
        <Route path=":projectId/settings/apps" element={<AppSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
