import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/pages/DashboardLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { ProjectPage } from "@/pages/ProjectPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { StubProjectPage } from "@/pages/StubProjectPage";
import { TermsPage } from "@/pages/TermsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path=":projectId" element={<ProjectPage />} />
        <Route path=":projectId/campaigns" element={<StubProjectPage title="Campaigns" />} />
        <Route path=":projectId/attribution" element={<StubProjectPage title="Attribution" />} />
        <Route path=":projectId/links" element={<StubProjectPage title="Links" />} />
        <Route path=":projectId/events" element={<StubProjectPage title="Events" />} />
        <Route path=":projectId/skan" element={<StubProjectPage title="SKAN" />} />
        <Route path=":projectId/settings/apps" element={<StubProjectPage title="App settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
