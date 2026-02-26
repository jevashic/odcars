import { CalendarDays, DollarSign, Car, ClipboardList } from 'lucide-react';

const kpis = [
  { icon: ClipboardList, label: 'Reservas hoy', value: '—', color: 'bg-cta/10 text-cta' },
  { icon: CalendarDays, label: 'Reservas este mes', value: '—', color: 'bg-secondary/10 text-secondary' },
  { icon: DollarSign, label: 'Ingresos este mes', value: '—', color: 'bg-emerald-100 text-emerald-700' },
  { icon: Car, label: 'Vehículos disponibles', value: '—', color: 'bg-primary/10 text-primary' },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-lg ${k.color} flex items-center justify-center mb-3`}>
              <k.icon className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-bold text-foreground mb-4">Últimas reservas</h2>
        <p className="text-muted-foreground text-sm">Conecta con los datos de Supabase para ver las reservas recientes.</p>
      </div>
    </div>
  );
}
