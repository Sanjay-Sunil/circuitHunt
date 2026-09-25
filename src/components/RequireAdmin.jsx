import { useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useMultiSession } from '../hooks/useSingleSession';

export default function RequireAdmin({ children }) {
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

  const onKicked = useCallback(() => {
    sessionStorage.removeItem('isAdmin');
    alert('The maximum of 6 admin devices is already connected.');
    window.location.href = '/admin/login';
  }, []);

  useMultiSession('adminSession', isAdmin, onKicked, 6);

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
