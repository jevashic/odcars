import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

const ALLOWED_ROLES = ["admin", "manager"];

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const verifyRole = async (authUserId: string, email: string) => {
    const { data: internal } = await supabase
      .from("internal_users")
      .select("id, role, display_name")
      .eq("auth_user_id", authUserId)
      .eq("is_active", true)
      .maybesingle();

    if (!internal || !ALLOWED_ROLES.includes(internal.role)) {
      await supabase.auth.signOut();
      navigate("/admin", { replace: true });
      setUser(null);
      return;
    }

    setUser({
      id: authUserId,
      email,
      role: internal.role,
      display_name: internal.display_name,
    });
  };

  useEffect(() => {
    // Listen for auth changes first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await verifyRole(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
        navigate("/admin", { replace: true });
      }
      setLoading(false);
    });

    // Then check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await verifyRole(session.user.id, session.user.email ?? "");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/admin", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return <AdminAuthContext.Provider value={{ user, loading, logout }}>{children}</AdminAuthContext.Provider>;
}
