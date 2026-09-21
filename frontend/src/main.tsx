import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tokens.css'
import './styles/appearance.css'
import './index.css'
import { AppearanceProvider } from './context/AppearanceContext'
import { GlobalAppearance } from './components/GlobalAppearance'
import { AuthProvider } from './context/AuthContext'
import { ChatSocketProvider } from './context/ChatSocketContext'
import { MessengerUiProvider } from './context/MessengerUiContext'
import { MessengerHost } from './messenger/MessengerHost'
import { SessionExpiredModal } from './components/SessionExpiredModal'
import { I18nProvider } from './context/I18nContext'
import { PageVisitTracker } from './components/PageVisitTracker'
import { YandexMetrika } from './components/YandexMetrika'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DreamsList from './pages/dreams/List'
import DreamFeedbackPage from './pages/dreams/Feedback'
import DreamDetail from './pages/dreams/Detail'
import ParanormalList from './pages/paranormal/List'
import ClientsList from './pages/clients/List'
import ClientDetail from './pages/clients/Detail'
import ClientProfileView from './pages/clients/Profile'
import MaterialsList from './pages/materials/List'
import MaterialDetail from './pages/materials/Detail'
import ProfilePage from './pages/profile/Profile'
import EventsPage from './pages/events/Events'
import PublicCalendarBookPage from './pages/events/PublicCalendarBookPage'
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
import ClientPsychologistsList from './pages/client/PsychologistsList'
import ClientSessions from './pages/client/Sessions'
import ClientAIChat from './pages/client/ClientAIChat'
import ClientCare from './pages/client/Care'
import ClientProgress from './pages/client/Progress'
import ClientMatch from './pages/client/Match'
import ClientCertificate from './pages/client/Certificate'
import VoiceRoom from './pages/room/VoiceRoom'
import { ResearcherDashboard } from './pages/researcher/Dashboard'
import ResearcherProfile from './pages/researcher/Profile'
import ResearcherPeople from './pages/researcher/People'
import ResearcherDreams from './pages/researcher/Dreams'
import ResearcherSupport from './pages/researcher/Support'
import ResearcherAIChat from './pages/researcher/AIChat'
import ResearcherIndividuationModel from './pages/researcher/IndividuationModel'
import ResearcherProjects from './pages/researcher/ResearchProjects'
import ResearchProjectSpace from './pages/researcher/ResearchProjectSpace'
import ResearcherCalls from './pages/researcher/ResearcherCalls'
import CommunityView from './pages/publications/CommunityView'
import CommunityManage from './pages/publications/CommunityManage'
import PostView from './pages/publications/PostView'
import CommunitiesCatalog from './pages/publications/CommunitiesCatalog'
import CommunitiesDirectory from './pages/publications/CommunitiesDirectory'
import NewPostPage from './pages/publications/NewPost'
import PsychologistProfile from './pages/psychologist/Profile'
import PsychologistSupport from './pages/psychologist/Support'
import PsychologistHandbook from './pages/psychologist/Handbook'
import PsychologistAIChat from './pages/psychologist/AIChat'
import AdminDashboard from './pages/admin/Dashboard'
import AdminVerification from './pages/admin/Verification'
import AdminSupport from './pages/admin/Support'
import AdminOpenAccess from './pages/admin/OpenAccess'
import AdminUserManagement from './pages/admin/UserManagement'
import AdminPsychologistsCatalog from './pages/admin/PsychologistsCatalog'
import AdminMailings from './pages/admin/Mailings'
import AdminAnalytics from './pages/admin/Analytics'
import RegisterClient from './pages/auth/RegisterClient'
import Register from './pages/Register'
import GuestPage from './pages/guest/Guest'
import GuestTests from './pages/guest/GuestTests'
import GuestDreams from './pages/guest/GuestDreams'
import PsychologistsCatalog from './pages/psychologists/Catalog'
import PublicPsychologistProfile from './pages/psychologists/PublicProfile'
import ForPsychologistsPage from './pages/landing/psychologist/ForPsychologistsPage'
import ForClientsPage from './pages/landing/client/ForClientsPage'
import ForResearchersPage from './pages/landing/researcher/ForResearchersPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ForcedEmailMigrationModal } from './components/EmailChangeFlow'
import { MobileInstallPrompt } from './components/MobileInstallPrompt'
import AboutPlatform from './pages/AboutPlatform'
import LegalDocumentPage from './pages/legal/LegalDocumentPage'
import ContactsPage from './pages/legal/ContactsPage'
import { CookieConsentBanner } from './components/CookieConsentBanner'
import { ErrorBoundary } from './ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppearanceProvider>
        <GlobalAppearance />
        <I18nProvider>
          <AuthProvider>
            <ChatSocketProvider>
            <MessengerUiProvider>
            <PageVisitTracker />
            <YandexMetrika />
            <MessengerHost />
            <SessionExpiredModal />
            <ForcedEmailMigrationModal />
            <MobileInstallPrompt />
            <CookieConsentBanner />
            <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ForPsychologistsPage />} />
              <Route path="/for-psychologists" element={<Navigate to="/" replace />} />
              <Route path="/for-clients" element={<ForClientsPage />} />
              <Route path="/for-researchers" element={<ForResearchersPage />} />
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
              <Route path="/guest/publications" element={<Navigate to="/communities" replace />} />
              <Route path="/publications/post/:id" element={<PostView />} />
              <Route path="/guest/dreams" element={<GuestDreams />} />
              <Route path="/psychologists" element={<PsychologistsCatalog />} />
              <Route path="/psychologists/:id" element={<PublicPsychologistProfile />} />

              <Route path="/terms" element={<LegalDocumentPage slug="terms" />} />
              <Route path="/privacy" element={<LegalDocumentPage slug="privacy" />} />
              <Route path="/personal-data-consent" element={<LegalDocumentPage slug="personal-data-consent" />} />
              <Route path="/contacts" element={<ContactsPage />} />

              <Route
                path="/about"
                element={
                  <ProtectedRoute roles={['client', 'psychologist', 'researcher', 'admin']}>
                    <AboutPlatform />
                  </ProtectedRoute>
                }
              />

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
                path="/psychologist/handbook"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <PsychologistHandbook />
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
              <Route path="/psychologist/requests" element={<Navigate to="/events#requests" replace />} />
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
                path="/admin/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminUserManagement />
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
                path="/admin/psychologists-catalog"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminPsychologistsCatalog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/mailings"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminMailings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminAnalytics />
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
                element={<Navigate to="/dreams?new=1" replace />}
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
                path="/paranormal"
                element={
                  <ProtectedRoute roles={['psychologist', 'admin']}>
                    <ParanormalList />
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
                path="/publications/new"
                element={
                  <ProtectedRoute roles={['psychologist', 'researcher', 'admin', 'client']}>
                    <NewPostPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/publications"
                element={<Navigate to="/communities?scope=mine" replace />}
              />
              <Route
                path="/feed"
                element={<Navigate to="/communities" replace />}
              />
              <Route path="/communities/catalog" element={<CommunitiesDirectory />} />
              <Route path="/communities" element={<CommunitiesCatalog />} />
              <Route path="/publications/community/:slug" element={<CommunityView />} />
              <Route
                path="/publications/community/:id/manage"
                element={
                  <ProtectedRoute roles={['psychologist', 'researcher', 'admin', 'client']}>
                    <CommunityManage />
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
              <Route path="/client/community" element={<Navigate to="/communities" replace />} />
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
                path="/client/ai"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientAIChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/care"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientCare />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/progress"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientProgress />
                  </ProtectedRoute>
                }
              />
              <Route path="/match" element={<ClientMatch />} />
              <Route
                path="/client/match"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientMatch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/certificate"
                element={
                  <ProtectedRoute roles={['client', 'admin']}>
                    <ClientCertificate />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/book/calendar"
                element={<PublicCalendarBookPage />}
              />

              <Route
                path="/room/:roomId"
                element={<VoiceRoom />}
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
                path="/researcher/individuation"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherIndividuationModel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/projects"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherProjects />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/projects/:projectId"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearchProjectSpace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/researcher/calls"
                element={
                  <ProtectedRoute roles={['researcher', 'admin']}>
                    <ResearcherCalls />
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
            </ErrorBoundary>
            </MessengerUiProvider>
            </ChatSocketProvider>
          </AuthProvider>
        </I18nProvider>
      </AppearanceProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
