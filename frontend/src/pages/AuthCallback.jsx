import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { processSessionId, user } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      // Extract session_id from URL hash
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error('No session_id in URL');
        navigate('/login', { replace: true });
        return;
      }

      try {
        const userData = await processSessionId(sessionId);
        
        // Redirect based on role
        if (userData.role === 'coach' && userData.linked_coach_id) {
          navigate(`/coach-view/${userData.linked_coach_id}`, { replace: true, state: { user: userData } });
        } else {
          navigate('/', { replace: true, state: { user: userData } });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { 
          replace: true, 
          state: { error: err.message } 
        });
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
        <p className="text-slate-600">Signing you in...</p>
      </div>
    </div>
  );
}
