import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
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
];

const configLinks: NavItem[] = [
  { to: "/admin/oficinas", icon: MapPin, label: "Oficinas", roles: ["admin"] },
  { to: "/admin/usuarios", icon: UserCog, label: "Usuarios", roles: ["admin"] },
  { to: "/admin/contenido/home", icon: FileText, label: "Contenido web", roles: ["admin"] },
  { to: "/admin/conoce-gran-canaria", icon: Compass, label: "Conoce Gran Canaria", roles: ["admin"] },
  { to: "/admin/banners", icon: Image, label: "Banners", roles: ["admin"] },
  { to: "/admin/chat", icon: MessageCircle, label: "Chat", roles: ["admin"] },
  { to: "/admin/seguros", icon: Shield, label: "Seguros", roles: ["admin"] },
  { to: "/admin/newsletter", icon: Mail, label: "Newsletter", roles: ["admin"] },
  { to: "/admin/branding", icon: Palette, label: "Branding", roles: ["admin"] },
  { to: "/admin/configuracion", icon: Sliders, label: "Configuración avanzada", roles: ["admin"] },
  { to: "/admin/informes-completos", icon: BarChart3, label: "Informes completos", roles: ["admin"] },
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
                <span className="flex-1 text-left">Configuración</span>
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

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </div>
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
