import { useState } from "react";
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
  Car,
  Layers,
  DollarSign,
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
  Image,
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
  { to: "/admin/vehiculos", icon: Car, label: "Flota", roles: ["employee", "manager", "admin"] },
  { to: "/admin/clientes", icon: Users, label: "Clientes", roles: ["employee", "manager", "admin"] },
  { to: "/admin/categorias", icon: Layers, label: "Categorías", roles: ["manager", "admin"] },
  { to: "/admin/precios", icon: DollarSign, label: "Precios", roles: ["manager", "admin"] },
  { to: "/admin/extras", icon: Package, label: "Extras", roles: ["manager", "admin"] },
  { to: "/admin/descuentos", icon: Percent, label: "Descuentos", roles: ["manager", "admin"] },
  { to: "/admin/facturacion", icon: Receipt, label: "Facturación", roles: ["manager", "admin"] },
  { to: "/admin/informes", icon: BarChart3, label: "Informes", roles: ["manager", "admin"] },
  { to: "/admin/oficinas", icon: MapPin, label: "Oficinas", roles: ["admin"] },
  { to: "/admin/seguros", icon: Shield, label: "Seguros", roles: ["admin"] },
  { to: "/admin/informes-completos", icon: BarChart3, label: "Informes completos", roles: ["admin"] },
];

const configLinks: NavItem[] = [
  { to: "/admin/usuarios", icon: UserCog, label: "Usuarios", roles: ["admin"] },
  { to: "/admin/contenido/home", icon: FileText, label: "Contenido web", roles: ["admin"] },
  { to: "/admin/conoce-gran-canaria", icon: Compass, label: "Conoce Gran Canaria", roles: ["admin"] },
  { to: "/admin/banners", icon: Image, label: "Banners", roles: ["admin"] },
  { to: "/admin/chat", icon: MessageCircle, label: "Chat", roles: ["admin"] },
  { to: "/admin/newsletter", icon: Mail, label: "Newsletter", roles: ["admin"] },
  { to: "/admin/branding", icon: Palette, label: "Branding", roles: ["admin"] },
];

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
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
      {item.label}
    </Link>
  );
}

function AdminLayoutInner() {
  const location = useLocation();
  const { user, logout } = useAdminAuth();
  const [configOpen, setConfigOpen] = useState(false);

  const role = (user?.role ?? "employee") as AdminRole;
  const visibleMain = mainLinks.filter((l) => l.roles.includes(role));
  const isAdmin = role === "admin";

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
      // Search by reservation code or client email
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from("reservations")
        .select("id, reservation_code, customer_email")
        .or(`reservation_code.ilike.%${q}%,customer_email.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSearchModalOpen(false);
        setSearchQuery("");
        navigate(`/admin/reservas/${data.id}`);
      } else {
        setSearchError("No se encontró ninguna reserva con ese dato");
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
            <SidebarLink key={l.to} item={l} active={location.pathname.startsWith(l.to)} />
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
          <Button
            onClick={() => navigate("/admin/reservas/nueva")}
            className="h-10 px-6 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            🚗 NUEVA RESERVA
          </Button>
          <Button
            onClick={() => { setSearchModalOpen(true); setSearchError(""); setSearchQuery(""); }}
            variant="outline"
            className="h-10 px-6 rounded-lg text-sm font-bold border-primary text-primary hover:bg-primary/5"
          >
            🔍 CONSULTAR RESERVA
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
            <DialogDescription>Busca por número de reserva o email del cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="Número de reserva o email del cliente"
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
