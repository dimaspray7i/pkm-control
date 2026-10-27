import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/ui/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import Development from './pages/Development'
import AIAnalyst from './pages/AiAnalyst'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Team from './pages/Team'
import Settings from './pages/Settings'

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
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="development" element={<Development />} />
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
        <Route path="team" element={<Team />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
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