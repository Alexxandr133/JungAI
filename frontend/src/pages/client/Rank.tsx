import { Navigate } from 'react-router-dom';

/** Ранг объединён с активностью: один экран на `/client/tasks`. */
export default function ClientRank() {
  return <Navigate to="/client/tasks" replace />;
}
