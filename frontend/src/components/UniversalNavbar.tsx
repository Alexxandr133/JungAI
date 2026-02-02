import { useAuth } from '../context/AuthContext';
import { PsychologistNavbar } from './PsychologistNavbar';
import { ClientNavbar } from './ClientNavbar';
import { ResearcherNavbar } from './ResearcherNavbar';

export function UniversalNavbar() {
  const { user } = useAuth();
  
  if (user?.role === 'client') {
    return <ClientNavbar />;
  } else if (user?.role === 'researcher') {
    return <ResearcherNavbar />;
  } else {
    // psychologist, admin, or default
    return <PsychologistNavbar />;
  }
}

