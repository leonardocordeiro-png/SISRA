import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Welcome from './pages/Welcome';
import ReceptionLogin from './pages/reception/Login';
import ReceptionSearch from './pages/reception/Search';
import ReceptionConfirmation from './pages/reception/Confirmation';
import ActiveWaitingList from './pages/reception/ActiveWaitingList';

import ClassroomLogin from './pages/classroom/Login';
import ClassroomDashboard from './pages/classroom/Dashboard';
import ClassroomActivityLog from './pages/classroom/ActivityLog';
import EndOfDaySummary from './pages/classroom/EndOfDaySummary';

import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import EnhancedAdminDashboard from './pages/admin/EnhancedDashboard';
import StudentManagement from './pages/admin/StudentManagement';
import AccountRecovery from './pages/admin/AccountRecovery';
import AuthorizationRules from './pages/admin/AuthorizationRules';
import SecurityAuditLog from './pages/admin/SecurityAuditLog';
import PickupHistory from './pages/admin/PickupHistory';
import DataExportCenter from './pages/admin/DataExportCenter';
import UserManagement from './pages/admin/UserManagement';
import ClassroomManagement from './pages/admin/ClassroomManagement';
import ManageStaff from './pages/admin/ManageStaff';
import AddGuardian from './pages/admin/AddGuardian';
import StudentRegistration from './pages/admin/StudentRegistration';
import SystemSettings from './pages/admin/SystemSettings';
import StaffLeaderboard from './pages/admin/StaffLeaderboard';
import AdminQRGenerator from './pages/admin/QRGenerator';

import OnboardingDashboard from './pages/staff/OnboardingDashboard';
import FeedbackForm from './pages/staff/FeedbackForm';
import DailySafetyChecklist from './pages/staff/DailySafetyChecklist';

import ParentQRCard from './pages/parent/QRCard';
import LostAndFound from './pages/parent/LostAndFound';
import ParentPickupStatus from './pages/parent/PickupStatus';
import ParentLogin from './pages/parent/Login';
import SelfRegistration from './pages/parent/SelfRegistration';

import SystemStatus from './pages/system/SystemStatus';

import TotemHome from './pages/totem/TotemHome';
import TotemIdentify from './pages/totem/TotemIdentify';
import TotemSearch from './pages/totem/TotemSearch';
import TotemCodeEntry from './pages/totem/TotemCodeEntry';
import TotemQRScan from './pages/totem/TotemQRScan';
import TotemConfirmation from './pages/totem/TotemConfirmation';

const ADMIN_ROLES = ['ADMIN'];
const RECEPTION_ROLES = ['RECEPCIONISTA', 'ADMIN', 'COORDENADOR'];
const CLASSROOM_ROLES = ['SCT', 'ADMIN', 'COORDENADOR'];
const STAFF_ROLES = ['ADMIN', 'COORDENADOR', 'SCT', 'RECEPCIONISTA'];

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Welcome />} />
            <Route path="/recepcao/login" element={<ReceptionLogin />} />
            <Route path="/sala/login" element={<ClassroomLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/system/status" element={<SystemStatus />} />

            {/* Totem Routes (public — self-service kiosk for parents) */}
            <Route path="/totem" element={<TotemHome />} />
            <Route path="/totem/identificar" element={<TotemIdentify />} />
            <Route path="/totem/busca" element={<TotemSearch />} />
            <Route path="/totem/codigo" element={<TotemCodeEntry />} />
            <Route path="/totem/qr" element={<TotemQRScan />} />
            <Route path="/totem/confirmacao" element={<TotemConfirmation />} />

            {/* Parent Routes (public — accessed via QR code links) */}
            <Route path="/parent/login" element={<ParentLogin />} />
            <Route path="/parent/qr-card" element={<ParentQRCard />} />
            <Route path="/parent/achados-perdidos" element={<LostAndFound />} />
            <Route path="/parent/status/:id" element={<ParentPickupStatus />} />
            <Route path="/parent/cadastro/:token" element={<SelfRegistration />} />

            {/* Reception Routes — Protected */}
            <Route path="/recepcao/busca" element={
              <ProtectedRoute allowedRoles={RECEPTION_ROLES} loginPath="/recepcao/login">
                <ReceptionSearch />
              </ProtectedRoute>
            } />
            <Route path="/recepcao/confirmacao/:id" element={
              <ProtectedRoute allowedRoles={RECEPTION_ROLES} loginPath="/recepcao/login">
                <ReceptionConfirmation />
              </ProtectedRoute>
            } />
            <Route path="/recepcao/fila" element={
              <ProtectedRoute allowedRoles={RECEPTION_ROLES} loginPath="/recepcao/login">
                <ActiveWaitingList />
              </ProtectedRoute>
            } />

            {/* Classroom Routes — Protected */}
            <Route path="/sala/dashboard" element={
              <ProtectedRoute allowedRoles={CLASSROOM_ROLES} loginPath="/sala/login">
                <ClassroomDashboard />
              </ProtectedRoute>
            } />
            <Route path="/sala/historico" element={
              <ProtectedRoute allowedRoles={CLASSROOM_ROLES} loginPath="/sala/login">
                <ClassroomActivityLog />
              </ProtectedRoute>
            } />
            <Route path="/sala/resumo-dia" element={
              <ProtectedRoute allowedRoles={CLASSROOM_ROLES} loginPath="/sala/login">
                <EndOfDaySummary />
              </ProtectedRoute>
            } />

            {/* Admin Routes — Protected */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/dashboard-v2" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <EnhancedAdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/alunos" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <StudentManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/alunos/novo" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <StudentRegistration />
              </ProtectedRoute>
            } />
            <Route path="/admin/recuperar-senha" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <AccountRecovery />
              </ProtectedRoute>
            } />
            <Route path="/admin/regras-autorizacao" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <AuthorizationRules />
              </ProtectedRoute>
            } />
            <Route path="/admin/auditoria-seguranca" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <SecurityAuditLog />
              </ProtectedRoute>
            } />
            <Route path="/admin/historico-retiradas" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <PickupHistory />
              </ProtectedRoute>
            } />
            <Route path="/admin/exportar-dados" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <DataExportCenter />
              </ProtectedRoute>
            } />
            <Route path="/admin/usuarios" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/turmas" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <ClassroomManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/staff" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <ManageStaff />
              </ProtectedRoute>
            } />
            <Route path="/admin/guardians/add" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <AddGuardian />
              </ProtectedRoute>
            } />
            <Route path="/admin/configuracoes" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <SystemSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin/ranking-equipe" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <StaffLeaderboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/cartoes-qr" element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                <AdminQRGenerator />
              </ProtectedRoute>
            } />

            {/* Staff Routes — Protected */}
            <Route path="/staff/onboarding" element={
              <ProtectedRoute allowedRoles={STAFF_ROLES} loginPath="/">
                <OnboardingDashboard />
              </ProtectedRoute>
            } />
            <Route path="/staff/feedback" element={
              <ProtectedRoute allowedRoles={STAFF_ROLES} loginPath="/">
                <FeedbackForm />
              </ProtectedRoute>
            } />
            <Route path="/staff/checklist-seguranca" element={
              <ProtectedRoute allowedRoles={STAFF_ROLES} loginPath="/">
                <DailySafetyChecklist />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
