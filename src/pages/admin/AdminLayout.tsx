import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Car, Layers, DollarSign, Package, Percent, Users, MapPin, UserCog,
  FileText, MessageCircle, Shield, Mail, Palette, Settings, BarChart3, Receipt, LogOut,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import logoSquare from '@/assets/logo-square.png';

const links = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/reservas', icon: CalendarDays, label: 'Reservas' },
  { to: '/admin/vehiculos', icon: Car, label: 'Vehículos' },
  { to: '/admin/categorias', icon: Layers, label: 'Categorías' },
  { to: '/admin/precios', icon: DollarSign, label: 'Precios' },
  { to: '/admin/extras', icon: Package, label: 'Extras' },
  { to: '/admin/descuentos', icon: Percent, label: 'Descuentos' },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/oficinas', icon: MapPin, label: 'Oficinas' },
  { to: '/admin/usuarios', icon: UserCog, label: 'Usuarios' },
  { to: '/admin/contenido/home', icon: FileText, label: 'Contenido' },
  { to: '/admin/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/admin/seguros', icon: Shield, label: 'Seguros' },
  { to: '/admin/newsletter', icon: Mail, label: 'Newsletter' },
  { to: '/admin/branding', icon: Palette, label: 'Branding' },
  { to: '/admin/configuracion', icon: Settings, label: 'Configuración' },
  { to: '/admin/informes', icon: BarChart3, label: 'Informes' },
  { to: '/admin/facturacion', icon: Receipt, label: 'Facturación' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0">
        <div className="p-4 flex items-center gap-3 border-b border-[#E2E8F0]">
          <img src={logoSquare} alt="Ocean Drive" className="h-8 w-8 rounded" />
          <span className="font-bold text-sm text-primary">Ocean Drive</span>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {links.map((l) => {
            const active = location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-cta/10 text-cta font-bold border-r-2 border-cta' : 'text-foreground/70 hover:bg-accent'}`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/5 border-t border-[#E2E8F0]">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </aside>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
