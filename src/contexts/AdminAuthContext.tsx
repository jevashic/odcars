import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
}

interface AdminAuthCtx {
  user: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthCtx>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAdminAuth = () => useContext(AdminAuthContext);

const ALLOWED_ROLES = ['admin', 'manager'];

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const verifying = useRef(false);

  const verifyRole = async (authUserId: string, email: string): Promise<boolean> => {
    if (verifying.current) return false;
    verifying.current = true;

    try {
      const { data: internal, error } = await supabase
        .from('internal_users')
        .select('id, role, display_name')
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error querying internal_users:', error);
        // Don't sign out on query errors (could be transient)
        return false;
      }

      if (!internal || !ALLOWED_ROLES.includes(internal.role)) {
        await supabase.auth.signOut();
        setUser(null);
        navigate('/admin', { replace: true });
        return false;
      }

      setUser({
        id: authUserId,
        email,
        role: internal.role,
        display_name: internal.display_name,
      });
      return true;
    } finally {
      verifying.current = false;
    }
  };

  useEffect(() => {
    // Listen for auth changes — only react to SIGNED_OUT
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      },
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await verifyRole(session.user.id, session.user.email ?? '');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/admin', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AdminAuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
