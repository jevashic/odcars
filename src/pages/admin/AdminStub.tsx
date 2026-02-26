import { useLocation } from 'react-router-dom';

const sectionNames: Record<string, string> = {
  reservas: 'Reservas',
  vehiculos: 'Vehículos',
  categorias: 'Categorías',
  precios: 'Precios',
  extras: 'Extras',
  descuentos: 'Descuentos',
  clientes: 'Clientes',
  oficinas: 'Oficinas',
  usuarios: 'Usuarios',
  chat: 'Chat',
  seguros: 'Seguros',
  newsletter: 'Newsletter',
  branding: 'Branding',
  configuracion: 'Configuración',
  informes: 'Informes',
  facturacion: 'Facturación',
};

export default function AdminStub() {
  const { pathname } = useLocation();
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  const title = sectionNames[segment] ?? segment;

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-4">{title}</h1>
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-muted-foreground">Sección <strong>{title}</strong> — conectada al backend de Supabase.</p>
        <p className="text-sm text-muted-foreground mt-2">Implementación completa del CRUD en progreso.</p>
      </div>
    </div>
  );
}
