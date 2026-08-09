import { useAuth } from '../context/AuthContext';
import { PsychologistNavbar } from './PsychologistNavbar';
import { ClientNavbar } from './ClientNavbar';
import { ResearcherNavbar } from './ResearcherNavbar';
import { AdminNavbar } from './AdminNavbar';

export function UniversalNavbar() {
  const { user } = useAuth();

  if (user?.role === 'client') {
    return <ClientNavbar />;
  }
  if (user?.role === 'researcher') {
    return <ResearcherNavbar />;
  }
  if (user?.role === 'admin') {
    return <AdminNavbar />;
  }
  return <PsychologistNavbar />;
}

