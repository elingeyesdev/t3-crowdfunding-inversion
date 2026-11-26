import { lazy } from 'react';
import { AsyncContent } from './components/AsyncContent.tsx';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const InvestorProfilePage = lazy(() =>
  import('./pages/InvestorProfilePage').then((module) => ({ default: module.InvestorProfilePage })),
);
const InvestorDashboardPage = lazy(() =>
  import('./pages/InvestorDashboardPage').then((module) => ({
    default: module.InvestorDashboardPage,
  })),
);
const EntrepreneurProfilePage = lazy(() =>
  import('./pages/EntrepreneurProfilePage').then((module) => ({
    default: module.EntrepreneurProfilePage,
  })),
);
const MyCampaignsPage = lazy(() =>
  import('./pages/MyCampaignsPage').then((module) => ({ default: module.MyCampaignsPage })),
);
const ExploreCampaignsPage = lazy(() =>
  import('./pages/ExploreCampaignsPage').then((module) => ({
    default: module.ExploreCampaignsPage,
  })),
);
const CampaignDetailPage = lazy(() =>
  import('./pages/CampaignDetailPage').then((module) => ({ default: module.CampaignDetailPage })),
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const SuperAdminDashboardPage = lazy(() =>
  import('./pages/admin/SuperAdminDashboardPage').then((module) => ({
    default: module.SuperAdminDashboardPage,
  })),
);
const CampaignReviewPage = lazy(() =>
  import('./pages/admin/CampaignReviewPage').then((module) => ({
    default: module.CampaignReviewPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminCampaignsPage = lazy(() =>
  import('./pages/admin/AdminCampaignsPage').then((module) => ({
    default: module.AdminCampaignsPage,
  })),
);
const AdminKycPage = lazy(() =>
  import('./pages/admin/AdminKycPage').then((module) => ({ default: module.AdminKycPage })),
);
const AdminExpensesAuditPage = lazy(() =>
  import('./pages/admin/AdminExpensesAuditPage').then((module) => ({
    default: module.AdminExpensesAuditPage,
  })),
);
const PitchFeedPage = lazy(() =>
  import('./pages/PitchFeedPage').then((module) => ({ default: module.PitchFeedPage })),
);
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const OAuthCallbackPage = lazy(() =>
  import('./pages/OAuthCallbackPage').then((module) => ({ default: module.OAuthCallbackPage })),
);
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const PasswordRecoveryPage = lazy(() =>
  import('./pages/PasswordRecoveryPage').then((module) => ({
    default: module.PasswordRecoveryPage,
  })),
);
const EmailVerificationPage = lazy(() =>
  import('./pages/EmailVerificationPage').then((module) => ({
    default: module.EmailVerificationPage,
  })),
);

// Guard simple: si no hay token, redirige a login con la ruta previa en el estado
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  const location = useLocation();
  return token ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AsyncContent key={location.pathname}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
        <Route path="/reset-password" element={<PasswordRecoveryPage reset />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/explore" element={<ExploreCampaignsPage />} />
        <Route path="/donatok" element={<PitchFeedPage />} />
        <Route path="/campaign/:id" element={<CampaignDetailPage />} />
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <InvestorDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <InvestorProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entrepreneur-profile"
          element={
            <PrivateRoute>
              <EntrepreneurProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entrepreneur-campaigns"
          element={
            <PrivateRoute>
              <MyCampaignsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PrivateRoute>
              <AdminUsersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <PrivateRoute>
              <AdminCampaignsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <PrivateRoute>
              <AdminKycPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/campaigns/review"
          element={
            <PrivateRoute>
              <CampaignReviewPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/expenses"
          element={
            <PrivateRoute>
              <AdminExpensesAuditPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/superadmin"
          element={
            <PrivateRoute>
              <SuperAdminDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/account-settings"
          element={
            <PrivateRoute>
              <AccountSettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <NotificationsPage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AsyncContent>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
