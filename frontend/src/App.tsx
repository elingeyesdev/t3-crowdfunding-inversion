import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InvestorProfilePage } from './pages/InvestorProfilePage';
import { InvestorDashboardPage } from './pages/InvestorDashboardPage';
import { EntrepreneurProfilePage } from './pages/EntrepreneurProfilePage';
import { MyCampaignsPage } from './pages/MyCampaignsPage';
import { ExploreCampaignsPage } from './pages/ExploreCampaignsPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { ChatPage } from './pages/ChatPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { SuperAdminDashboardPage } from './pages/admin/SuperAdminDashboardPage';
import { CampaignReviewPage } from './pages/admin/CampaignReviewPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminCampaignsPage } from './pages/admin/AdminCampaignsPage';
import { AdminKycPage } from './pages/admin/AdminKycPage';
import { AdminExpensesAuditPage } from './pages/admin/AdminExpensesAuditPage';
import { PitchFeedPage } from './pages/PitchFeedPage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';

// Guard simple: si no hay token, redirige a login con la ruta previa en el estado
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  const location = useLocation();
  return token ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
