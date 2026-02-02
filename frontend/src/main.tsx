import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './context/I18nContext'
import { ErrorBoundary } from './ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DreamsList from './pages/dreams/List'
import DreamCreate from './pages/dreams/Create'
import DreamFeedbackPage from './pages/dreams/Feedback'
import DreamDetail from './pages/dreams/Detail'
import ClientsList from './pages/clients/List'
import ClientDetail from './pages/clients/Detail'
import ClientProfileView from './pages/clients/Profile'
import MaterialsList from './pages/materials/List'
import MaterialDetail from './pages/materials/Detail'
import ProfilePage from './pages/profile/Profile'
import EventsPage from './pages/events/Events'
import AmplificationsPage from './pages/research/Amplifications'
import AIRecommendationsPage from './pages/ai/Recommendations'
import TasksPage from './pages/tasks/Tasks'
import ChatPage from './pages/chat/Chat'
import PsychologistWorkspace from './pages/psychologist/Workspace'
import PsychologistDashboard from './pages/psychologist/Dashboard'
import WorkArea from './pages/psychologist/WorkArea'
import ClientWorkspace from './pages/client/Workspace'
import ClientProfile from './pages/client/Profile'
import ClientJournal from './pages/client/Journal'
import ClientTasks from './pages/client/Tasks'
import ClientRank from './pages/client/Rank'
import ClientTests from './pages/client/Tests'
import ClientCommunity from './pages/client/Community'
import ClientSessions from './pages/client/Sessions'
import ClientPsychologistsList from './pages/client/PsychologistsList'
import VoiceRoom from './pages/room/VoiceRoom'
import ResearcherDashboard from './pages/researcher/Dashboard'
import ResearcherProfile from './pages/researcher/Profile'
import ResearcherPeople from './pages/researcher/People'
import ResearcherDreams from './pages/researcher/Dreams'
import ResearcherSupport from './pages/researcher/Support'
import ResearcherAIChat from './pages/researcher/AIChat'
import PublicationsPage from './pages/publications/Publications'
import PsychologistProfile from './pages/psychologist/Profile'
import PsychologistSupport from './pages/psychologist/Support'
import PsychologistAIChat from './pages/psychologist/AIChat'
import AdminDashboard from './pages/admin/Dashboard'
import AdminVerification from './pages/admin/Verification'
import AdminSupport from './pages/admin/Support'
import AdminOpenAccess from './pages/admin/OpenAccess'
import RegisterClient from './pages/auth/RegisterClient'
import Register from './pages/Register'
import GuestPage from './pages/guest/Guest'
import GuestTests from './pages/guest/GuestTests'
import GuestCommunity from './pages/guest/GuestCommunity'
import GuestPublications from './pages/guest/GuestPublications'
import GuestDreams from './pages/guest/GuestDreams'
import PsychologistsList from './pages/guest/PsychologistsList'
import { ProtectedRoute } from './components/ProtectedRoute'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register-client" element={<RegisterClient />} />

              <Route
                path="/guest"
                element={
                  <ProtectedRoute roles={['guest', 'admin']}>
                    <GuestPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/guest/tests" element={<GuestTests />} />
              <Route path="/guest/community" element={<GuestCommunity />} />
              <Route path="/guest/publications" element={<GuestPublications />} />
              <Route path="/guest/dreams" element={<GuestDreams />} />
              <Route path="/psychologists" element={<PsychologistsList />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/psychologist"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/psychologist/workspace"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/psychologist/work-area"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <WorkArea />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/psychologist/profile"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/psychologist/support"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistSupport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/psychologist/ai"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistAIChat />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/verification"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminVerification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/support"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminSupport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/open-access"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminOpenAccess />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/clients"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <ClientsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <ClientDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id/profile"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <ClientProfileView />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dreams"
                element={
                  <ProtectedRoute roles={['client', 'psychologist', 'admin']}>
                    <DreamsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dreams/new"
                element={
                  <ProtectedRoute roles={['client', 'psychologist', 'admin']}>
                    <DreamCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dreams/:id"
                element={
                  <ProtectedRoute roles={['client', 'psychologist', 'admin']}>
                    <DreamDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dreams/:id/feedback"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <DreamFeedbackPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/materials"
                element={
                  <ProtectedRoute>
                    <MaterialsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materials/:id"
                element={
                  <ProtectedRoute>
                    <MaterialDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <EventsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/research/amplifications"
                element={
                  <ProtectedRoute roles={['psychologist', 'researcher', 'admin']}>
                    <AmplificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/publications"
                element={
                  <ProtectedRoute roles={['psychologist', 'researcher', 'admin']}>
                    <PublicationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai/recommendations"
                element={
                  <ProtectedRoute roles={['client', 'psychologist', 'admin']}>
                    <AIRecommendationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute roles={['psychologist', 'researcher', 'admin']}>
                    <TasksPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/client"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/profile"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/journal"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientJournal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/tasks"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientTasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/rank"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientRank />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/tests"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientTests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/community"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientCommunity />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/sessions"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientSessions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/psychologists"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientPsychologistsList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/room/:roomId"
                element={
                  <ProtectedRoute>
                    <VoiceRoom />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/researcher"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/profile"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/people"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherPeople />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/dreams"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherDreams />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/ai"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherAIChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/support"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherSupport />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<div>Not found</div>} />
            </Routes>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
