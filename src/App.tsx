import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// Splits each route into its own chunk, keeping the initial bundle small.
const Welcome               = lazy(() => import('./pages/Welcome'));

const ReceptionLogin        = lazy(() => import('./pages/reception/Login'));
const ReceptionSearch       = lazy(() => import('./pages/reception/Search'));
const ReceptionConfirmation = lazy(() => import('./pages/reception/Confirmation'));
const ActiveWaitingList     = lazy(() => import('./pages/reception/ActiveWaitingList'));

const ClassroomLogin        = lazy(() => import('./pages/classroom/Login'));
const ClassroomDashboard    = lazy(() => import('./pages/classroom/Dashboard'));
const ClassroomActivityLog  = lazy(() => import('./pages/classroom/ActivityLog'));
const EndOfDaySummary       = lazy(() => import('./pages/classroom/EndOfDaySummary'));

const AdminLogin            = lazy(() => import('./pages/admin/Login'));
const AdminDashboard        = lazy(() => import('./pages/admin/Dashboard'));
const EnhancedAdminDashboard = lazy(() => import('./pages/admin/EnhancedDashboard'));
const StudentManagement     = lazy(() => import('./pages/admin/StudentManagement'));
const AccountRecovery       = lazy(() => import('./pages/admin/AccountRecovery'));
const AuthorizationRules    = lazy(() => import('./pages/admin/AuthorizationRules'));
const SecurityAuditLog      = lazy(() => import('./pages/admin/SecurityAuditLog'));
const PickupHistory         = lazy(() => import('./pages/admin/PickupHistory'));
const DataExportCenter      = lazy(() => import('./pages/admin/DataExportCenter'));
const UserManagement        = lazy(() => import('./pages/admin/UserManagement'));
const ClassroomManagement   = lazy(() => import('./pages/admin/ClassroomManagement'));
const ManageStaff           = lazy(() => import('./pages/admin/ManageStaff'));
const AddGuardian           = lazy(() => import('./pages/admin/AddGuardian'));
const StudentRegistration   = lazy(() => import('./pages/admin/StudentRegistration'));
const SystemSettings        = lazy(() => import('./pages/admin/SystemSettings'));
const StaffLeaderboard      = lazy(() => import('./pages/admin/StaffLeaderboard'));
const AdminQRGenerator      = lazy(() => import('./pages/admin/QRGenerator'));
const MassScheduleUpdate    = lazy(() => import('./pages/admin/MassScheduleUpdate'));

const OnboardingDashboard   = lazy(() => import('./pages/staff/OnboardingDashboard'));
const FeedbackForm          = lazy(() => import('./pages/staff/FeedbackForm'));
const DailySafetyChecklist  = lazy(() => import('./pages/staff/DailySafetyChecklist'));

const ParentQRCard          = lazy(() => import('./pages/parent/QRCard'));
const LostAndFound          = lazy(() => import('./pages/parent/LostAndFound'));
const ParentPickupStatus    = lazy(() => import('./pages/parent/PickupStatus'));
const ParentLogin           = lazy(() => import('./pages/parent/Login'));
const SelfRegistration      = lazy(() => import('./pages/parent/SelfRegistration'));

const SystemStatus          = lazy(() => import('./pages/system/SystemStatus'));
const ReceptionBoard        = lazy(() => import('./pages/display/ReceptionBoard'));
const FamilyPortal          = lazy(() => import('./pages/portal/FamilyPortal'));

const TotemHome             = lazy(() => import('./pages/totem/TotemHome'));
const TotemIdentify         = lazy(() => import('./pages/totem/TotemIdentify'));
const TotemSearch           = lazy(() => import('./pages/totem/TotemSearch'));
const TotemCodeEntry        = lazy(() => import('./pages/totem/TotemCodeEntry'));
const TotemQRScan           = lazy(() => import('./pages/totem/TotemQRScan'));
const TotemConfirmation     = lazy(() => import('./pages/totem/TotemConfirmation'));

// ── Fallback while lazy chunks load ──────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#070a14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid rgba(199,158,97,0.2)',
        borderTopColor: '#c79e61',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Global Error Boundary ─────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh', background: '#070a14',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Algo deu errado</h2>
            <p style={{ color: '#8491A2', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              Ocorreu um erro inesperado. Recarregue a página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#c79e61', color: '#070a14', border: 'none',
                padding: '10px 28px', borderRadius: 10,
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Role constants ─────────────────────────────────────────────────────────────
const ADMIN_ROLES     = ['ADMIN'];
const RECEPTION_ROLES = ['RECEPCIONISTA', 'ADMIN', 'COORDENADOR'];
const CLASSROOM_ROLES = ['SCT', 'ADMIN', 'COORDENADOR'];
const STAFF_ROLES     = ['ADMIN', 'COORDENADOR', 'SCT', 'RECEPCIONISTA'];

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/admin/manutencao/horarios" element={
                  <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login">
                    <MassScheduleUpdate />
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

                {/* Display & Portal Routes (public — no auth required) */}
                <Route path="/display" element={<ReceptionBoard />} />
                <Route path="/portal" element={<FamilyPortal />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
