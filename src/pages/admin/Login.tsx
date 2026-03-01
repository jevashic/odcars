import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoSquare from "@/assets/logo-square.png";

const ALLOWED_ROLES = ["admin", "manager"];

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !data.user) {
      setError("Credenciales incorrectas");
      setLoading(false);
      return;
    }
    // Verify internal user with allowed role
    const { data: internal } = await supabase
      .from("internal_users")
      .select("role")
      .eq("auth_user_id", data.user.id)
      .eq("is_active", true)
      .single();

    if (!internal || !ALLOWED_ROLES.includes(internal.role)) {
      await supabase.auth.signOut();
      setError("Acceso no autorizado. Se requiere rol admin o manager.");
      setLoading(false);
      return;
      console.log("internal:", internal);
    }
    navigate("/admin/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-[hsl(200,55%,14%)] flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <img src={logoSquare} alt="Ocean Drive" className="h-16 w-16 mx-auto mb-6" />
        <h1 className="text-xl font-bold text-primary text-center mb-6">Panel de Administración</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border border-border mb-3 focus:border-primary outline-none"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border border-border mb-4 focus:border-primary outline-none"
        />
        {error && <p className="text-destructive text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Accediendo..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
