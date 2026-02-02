import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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

// ВРЕМЕННАЯ ОТЛАДКА: проверяем, что все импортированные компоненты реально являются React-компонентами,
// а не объектами/undefined. Это поможет найти источник ошибки React #130 на проде.
function debugValidateComponent(name: string, value: unknown) {
  const isFn = typeof value === 'function'
  const isElementLike =
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).$$typeof !== 'undefined'

  if (!isFn && !isElementLike) {
    // ВАЖНО: этот лог надо будет удалить после фикса
    console.error('[ROUTER DEBUG] Invalid component import for', name, '=>', value)
  }
}

debugValidateComponent('App', App)
debugValidateComponent('Login', Login)
debugValidateComponent('Dashboard', Dashboard)
debugValidateComponent('DreamsList', DreamsList)
debugValidateComponent('DreamCreate', DreamCreate)
debugValidateComponent('DreamFeedbackPage', DreamFeedbackPage)
debugValidateComponent('DreamDetail', DreamDetail)
debugValidateComponent('ClientsList', ClientsList)
debugValidateComponent('ClientDetail', ClientDetail)
debugValidateComponent('ClientProfileView', ClientProfileView)
debugValidateComponent('MaterialsList', MaterialsList)
debugValidateComponent('MaterialDetail', MaterialDetail)
debugValidateComponent('ProfilePage', ProfilePage)
debugValidateComponent('EventsPage', EventsPage)
debugValidateComponent('AmplificationsPage', AmplificationsPage)
debugValidateComponent('AIRecommendationsPage', AIRecommendationsPage)
debugValidateComponent('TasksPage', TasksPage)
debugValidateComponent('ChatPage', ChatPage)
debugValidateComponent('PsychologistWorkspace', PsychologistWorkspace)
debugValidateComponent('PsychologistDashboard', PsychologistDashboard)
debugValidateComponent('WorkArea', WorkArea)
debugValidateComponent('ClientWorkspace', ClientWorkspace)
debugValidateComponent('ClientProfile', ClientProfile)
debugValidateComponent('ClientJournal', ClientJournal)
debugValidateComponent('ClientTasks', ClientTasks)
debugValidateComponent('ClientRank', ClientRank)
debugValidateComponent('ClientTests', ClientTests)
debugValidateComponent('ClientCommunity', ClientCommunity)
debugValidateComponent('ClientSessions', ClientSessions)
debugValidateComponent('ClientPsychologistsList', ClientPsychologistsList)
debugValidateComponent('VoiceRoom', VoiceRoom)
debugValidateComponent('ResearcherDashboard', ResearcherDashboard)
debugValidateComponent('ResearcherProfile', ResearcherProfile)
debugValidateComponent('ResearcherPeople', ResearcherPeople)
debugValidateComponent('ResearcherDreams', ResearcherDreams)
debugValidateComponent('ResearcherSupport', ResearcherSupport)
debugValidateComponent('ResearcherAIChat', ResearcherAIChat)
debugValidateComponent('PublicationsPage', PublicationsPage)
debugValidateComponent('PsychologistProfile', PsychologistProfile)
debugValidateComponent('PsychologistSupport', PsychologistSupport)
debugValidateComponent('PsychologistAIChat', PsychologistAIChat)
debugValidateComponent('AdminDashboard', AdminDashboard)
debugValidateComponent('AdminVerification', AdminVerification)
debugValidateComponent('AdminSupport', AdminSupport)
debugValidateComponent('AdminOpenAccess', AdminOpenAccess)
debugValidateComponent('RegisterClient', RegisterClient)
debugValidateComponent('Register', Register)
debugValidateComponent('GuestPage', GuestPage)
debugValidateComponent('GuestTests', GuestTests)
debugValidateComponent('GuestCommunity', GuestCommunity)
debugValidateComponent('GuestPublications', GuestPublications)
debugValidateComponent('GuestDreams', GuestDreams)
debugValidateComponent('PsychologistsList', PsychologistsList)
debugValidateComponent('ProtectedRoute', ProtectedRoute)

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/register-client', element: <RegisterClient /> },
  { path: '/guest', element: <ProtectedRoute roles={["guest","admin"]}><GuestPage /></ProtectedRoute> },
  { path: '/guest/tests', element: <GuestTests /> },
  { path: '/guest/community', element: <GuestCommunity /> },
  { path: '/guest/publications', element: <GuestPublications /> },
  { path: '/guest/dreams', element: <GuestDreams /> },
  { path: '/psychologists', element: <PsychologistsList /> },
  { path: '/dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
  { path: '/profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
  { path: '/psychologist', element: <ProtectedRoute roles={["psychologist","admin"]}><PsychologistDashboard /></ProtectedRoute> },
  { path: '/psychologist/workspace', element: <ProtectedRoute roles={["psychologist","admin"]}><PsychologistWorkspace /></ProtectedRoute> },
  { path: '/psychologist/work-area', element: <ProtectedRoute roles={["psychologist","admin"]}><WorkArea /></ProtectedRoute> },
  { path: '/psychologist/profile', element: <ProtectedRoute roles={["psychologist","admin"]}><PsychologistProfile /></ProtectedRoute> },
  { path: '/psychologist/support', element: <ProtectedRoute roles={["psychologist","admin"]}><PsychologistSupport /></ProtectedRoute> },
  { path: '/psychologist/ai', element: <ProtectedRoute roles={["psychologist","admin"]}><PsychologistAIChat /></ProtectedRoute> },
  { path: '/admin', element: <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute> },
  { path: '/admin/verification', element: <ProtectedRoute roles={["admin"]}><AdminVerification /></ProtectedRoute> },
  { path: '/admin/support', element: <ProtectedRoute roles={["admin"]}><AdminSupport /></ProtectedRoute> },
  { path: '/admin/open-access', element: <ProtectedRoute roles={["admin"]}><AdminOpenAccess /></ProtectedRoute> },
  { path: '/clients', element: <ProtectedRoute roles={["psychologist","admin"]}><ClientsList /></ProtectedRoute> },
  { path: '/clients/:id', element: <ProtectedRoute roles={["psychologist","admin"]}><ClientDetail /></ProtectedRoute> },
  { path: '/clients/:id/profile', element: <ProtectedRoute roles={["psychologist","admin"]}><ClientProfileView /></ProtectedRoute> },
  { path: '/dreams', element: <ProtectedRoute roles={["client","psychologist","admin"]}><DreamsList /></ProtectedRoute> },
  { path: '/dreams/new', element: <ProtectedRoute roles={["client","psychologist","admin"]}><DreamCreate /></ProtectedRoute> },
  { path: '/dreams/:id', element: <ProtectedRoute roles={["client","psychologist","admin"]}><DreamDetail /></ProtectedRoute> },
  { path: '/dreams/:id/feedback', element: <ProtectedRoute roles={["psychologist","admin"]}><DreamFeedbackPage /></ProtectedRoute> },
  { path: '/materials', element: <ProtectedRoute><MaterialsList /></ProtectedRoute> },
  { path: '/materials/:id', element: <ProtectedRoute><MaterialDetail /></ProtectedRoute> },
  { path: '/events', element: <ProtectedRoute><EventsPage /></ProtectedRoute> },
  { path: '/research/amplifications', element: <ProtectedRoute roles={["psychologist","researcher","admin"]}><AmplificationsPage /></ProtectedRoute> },
  { path: '/publications', element: <ProtectedRoute roles={["psychologist","researcher","admin"]}><PublicationsPage /></ProtectedRoute> },
  { path: '/ai/recommendations', element: <ProtectedRoute roles={["client","psychologist","admin"]}><AIRecommendationsPage /></ProtectedRoute> },
  { path: '/tasks', element: <ProtectedRoute roles={["psychologist","researcher","admin"]}><TasksPage /></ProtectedRoute> },
  { path: '/chat', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
  { path: '/messages', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
  { path: '/client', element: <ProtectedRoute roles={["client","admin"]}><ClientWorkspace /></ProtectedRoute> },
  { path: '/client/profile', element: <ProtectedRoute roles={["client","admin"]}><ClientProfile /></ProtectedRoute> },
  { path: '/client/journal', element: <ProtectedRoute roles={["client","admin"]}><ClientJournal /></ProtectedRoute> },
  { path: '/client/tasks', element: <ProtectedRoute roles={["client","admin"]}><ClientTasks /></ProtectedRoute> },
  { path: '/client/rank', element: <ProtectedRoute roles={["client","admin"]}><ClientRank /></ProtectedRoute> },
  { path: '/client/tests', element: <ProtectedRoute roles={["client","admin"]}><ClientTests /></ProtectedRoute> },
  { path: '/client/community', element: <ProtectedRoute roles={["client","admin"]}><ClientCommunity /></ProtectedRoute> },
  { path: '/client/sessions', element: <ProtectedRoute roles={["client","admin"]}><ClientSessions /></ProtectedRoute> },
  { path: '/client/psychologists', element: <ProtectedRoute roles={["client","admin"]}><ClientPsychologistsList /></ProtectedRoute> },
  { path: '/room/:roomId', element: <ProtectedRoute><VoiceRoom /></ProtectedRoute> },
  { path: '/researcher', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherDashboard /></ProtectedRoute> },
  { path: '/researcher/profile', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherProfile /></ProtectedRoute> },
  { path: '/researcher/people', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherPeople /></ProtectedRoute> },
  { path: '/researcher/dreams', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherDreams /></ProtectedRoute> },
  { path: '/researcher/ai', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherAIChat /></ProtectedRoute> },
  { path: '/researcher/support', element: <ProtectedRoute roles={["researcher","admin"]}><ResearcherSupport /></ProtectedRoute> },
  { path: '*', element: <div>Not found</div> }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>,
)
