import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/ui/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Tasks from './pages/Tasks'
import Development from './pages/Development'
import AIAnalyst from './pages/AiAnalyst'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Team from './pages/Team'
import Settings from './pages/Settings'
import StrategicProjectPortfolio from './pages/leadership/StrategicProjectPortfolio'
import BusinessPerformance from './pages/leadership/BusinessPerformance'
import FinancialPerformance from './pages/leadership/FinancialPerformance'
import RiskDecisionCenter from './pages/leadership/RiskDecisionCenter'
import AIExecutiveAdvisor from './pages/leadership/AIExecutiveAdvisor'
import ExecutiveReports from './pages/leadership/ExecutiveReports'
import StrategicObjectives from './pages/leadership/StrategicObjectives'
import StrategicInitiatives from './pages/leadership/StrategicInitiatives'
import ExecutiveActionCenter from './pages/leadership/ExecutiveActionCenter'
import MemberWorkCalendar from './pages/member/MemberWorkCalendar'
import MemberNotificationCenter from './pages/member/MemberNotificationCenter'
import NotFound from './pages/NotFound'

function DashboardRoute() {
  const { user } = useAuth()
  // Member memiliki Workspace pribadi di /tasks (MemberWorkspace); arahkan dari root
  if (user?.role === 'member') {
    return <Navigate to="/tasks" replace />
  }
  return <Dashboard />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardRoute />} />
        <Route
          path="portfolio"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <StrategicProjectPortfolio />
            </ProtectedRoute>
          }
        />
        <Route
          path="performance"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <BusinessPerformance />
            </ProtectedRoute>
          }
        />
        <Route
          path="financial"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <FinancialPerformance />
            </ProtectedRoute>
          }
        />
        <Route
          path="risk-center"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <RiskDecisionCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="ai-advisor"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <AIExecutiveAdvisor />
            </ProtectedRoute>
          }
        />
        <Route
          path="executive-reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <ExecutiveReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="strategic-objectives"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <StrategicObjectives />
            </ProtectedRoute>
          }
        />
        <Route
          path="strategic-initiatives"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan']}>
              <StrategicInitiatives />
            </ProtectedRoute>
          }
        />
        <Route
          path="executive-actions"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <ExecutiveActionCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route path="tasks" element={<Tasks />} />
        <Route
          path="member/calendar"
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MemberWorkCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/notifications"
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MemberNotificationCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="development"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <Development />
            </ProtectedRoute>
          }
        />
        <Route
          path="ai-analyst"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <AIAnalyst />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="team"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pimpinan', 'project_manager']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App