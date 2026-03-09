import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  CalendarClock,
  Car,
  Layers,
  
  Package,
  Percent,
  Users,
  MapPin,
  UserCog,
  FileText,
  MessageCircle,
  Shield,
  Mail,
  Palette,
  Settings,
  BarChart3,
  Receipt,
  LogOut,
  ChevronDown,
  Compass,
  Sliders,
} from "lucide-react";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import logoSquare from "@/assets/logo-square.png";

type AdminRole = "employee" | "manager" | "admin";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles: AdminRole[];
}

const mainLinks: NavItem[] = [
  { to: "/admin/reservas", icon: CalendarDays, label: "Reservas", roles: ["employee", "manager", "admin"] },
  { to: "/admin/movimientos", icon: CalendarClock, label: "Movimientos", roles: ["employee", "manager", "admin"] },
  { to: "/admin/vehiculos", icon: Car, label: "Flota", roles: ["employee", "manager", "admin"] },
  { to: "/admin/estado-flota", icon: Car, label: "Estado Flota", roles: ["employee", "manager", "admin"] },
  { to: "/admin/clientes", icon: Users, label: "Clientes", roles: ["employee", "manager", "admin"] },
  { to: "/admin/categorias", icon: Layers, label: "Categorías", roles: ["manager", "admin"] },
  { to: "/admin/extras", icon: Package, label: "Extras", roles: ["manager", "admin"] },
  { to: "/admin/descuentos", icon: Percent, label: "Descuentos", roles: ["manager", "admin"] },
  { to: "/admin/facturacion", icon: Receipt, label: "Facturación", roles: ["manager", "admin"] },
  { to: "/admin/informes", icon: BarChart3, label: "Informes", roles: ["manager", "admin"] },
];

const configLinks: NavItem[] = [
  { to: "/admin/oficinas", icon: MapPin, label: "Oficinas", roles: ["admin"] },
  
  { to: "/admin/usuarios", icon: UserCog, label: "Usuarios", roles: ["admin"] },
  { to: "/admin/seguros", icon: Shield, label: "Seguros", roles: ["admin"] },
  { to: "/admin/contenido", icon: FileText, label: "Contenido web", roles: ["admin"] },
  { to: "/admin/buscador", icon: Compass, label: "Configuración del buscador", roles: ["admin"] },
  { to: "/admin/conoce-gran-canaria", icon: Compass, label: "Conoce Gran Canaria", roles: ["admin"] },
  { to: "/admin/chat", icon: MessageCircle, label: "Chat", roles: ["admin"] },
  { to: "/admin/newsletter", icon: Mail, label: "Newsletter", roles: ["admin"] },
  { to: "/admin/branding", icon: Palette, label: "Branding", roles: ["admin"] },
  { to: "/admin/historial", icon: Sliders, label: "Historial de cambios", roles: ["admin"] },
];

function SidebarLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        active
          ? "bg-cta/10 text-cta font-bold border-r-2 border-cta"
          : "text-foreground/70 hover:bg-accent"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span className="flex-1">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </Link>
  );
}

function AdminLayoutInner() {
  const location = useLocation();
  const { user, logout } = useAdminAuth();
  const [configOpen, setConfigOpen] = useState(false);
  const [movementsBadge, setMovementsBadge] = useState(0);

  const role = (user?.role ?? "employee") as AdminRole;
  const visibleMain = mainLinks.filter((l) => l.roles.includes(role));
  const isAdmin = role === "admin";

  // Fetch movements badge count
  useEffect(() => {
    const fetchBadge = async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [unassigned, pickups, returns] = await Promise.all([
        supabase.from("reservations").select("id", { count: "exact", head: true }).is("vehicle_id", null).eq("status", "confirmed"),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("start_date", todayStr).in("status", ["confirmed", "active"]),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("end_date", todayStr).eq("status", "active"),
      ]);
      setMovementsBadge((unassigned.count ?? 0) + (pickups.count ?? 0) + (returns.count ?? 0));
    };
    fetchBadge();
  }, []);

  // Check if any config link is active to auto-expand
  const configActive = configLinks.some((l) => location.pathname.startsWith(l.to));

  // Search modal state
  const navigate = useNavigate();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from("reservations")
        .select("id, reservation_number")
        .eq("reservation_number", q)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSearchModalOpen(false);
        setSearchQuery("");
        navigate(`/admin/reservas/${data.id}`);
      } else {
        setSearchError("No se encontró ninguna reserva con ese número");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0">
        <div className="p-4 flex items-center gap-3 border-b border-[#E2E8F0]">
          <img src={logoSquare} alt="Ocean Drive" className="h-8 w-8 rounded" />
          <div className="flex flex-col">
            <span className="font-bold text-sm text-primary">Ocean Drive</span>
            {user && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {user.role}
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleMain.map((l) => (
            <SidebarLink
              key={l.to}
              item={l}
              active={location.pathname.startsWith(l.to)}
              badge={l.to === "/admin/movimientos" ? movementsBadge : undefined}
            />
          ))}

          {/* Admin-only collapsible config section */}
          {isAdmin && (
            <div className="mt-3 border-t border-[#E2E8F0] pt-2">
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent w-full transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="flex-1 text-left">⚙️ Configuración Avanzada</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    configOpen || configActive ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  configOpen || configActive ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="pl-2">
                  {configLinks.map((l) => (
                    <SidebarLink
                      key={l.to}
                      item={l}
                      active={location.pathname.startsWith(l.to)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </nav>
        <div className="border-t border-[#E2E8F0] px-4 py-2">
          {user && (
            <p className="text-xs text-muted-foreground truncate mb-1">
              {user.full_name || user.email}
            </p>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 py-2 text-sm text-destructive hover:opacity-80"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top bar with quick actions */}
        <header className="bg-white border-b border-[#E2E8F0] px-8 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => navigate("/admin/movimientos")}
            className="relative p-2 rounded-lg text-foreground/60 hover:bg-accent transition-colors"
            title="Movimientos pendientes"
          >
            <Mail className="h-5 w-5" />
            {movementsBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {movementsBadge}
              </span>
            )}
          </button>
          <Button
            onClick={() => { setSearchModalOpen(true); setSearchError(""); setSearchQuery(""); }}
            variant="outline"
            className="h-10 px-6 rounded-lg text-sm font-bold border-primary text-primary hover:bg-primary/5"
          >
            🔍 CONSULTAR RESERVA
          </Button>
          <Button
            onClick={() => navigate("/admin/reservas/nueva")}
            className="h-10 px-6 rounded-lg text-sm font-bold bg-cta text-cta-foreground hover:bg-cta/90"
          >
            🚗 NUEVA RESERVA
          </Button>
        </header>

        {/* Page content */}
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </div>

      {/* Search reservation modal */}
      <Dialog open={searchModalOpen} onOpenChange={setSearchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Consultar reserva</DialogTitle>
            <DialogDescription>Busca por número de reserva</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="OD-2026-0001"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              autoFocus
            />
            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="w-full font-bold">
              {searching ? "Buscando…" : "BUSCAR"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner />
    </AdminAuthProvider>
  );
}
