import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

export const ProtectedRoute: React.FC<{ children: React.ReactElement; roles?: UserRole[] }> = ({ children, roles }) => {
  const { token, user } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};
