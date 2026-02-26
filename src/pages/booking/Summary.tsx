import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PublicLayout from '@/components/layout/PublicLayout';

export default function Summary() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', emailConfirm: '', phone: '', licenseNumber: '', licenseExpiry: '', discountCode: '' });

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.email !== form.emailConfirm) return;
    const p = new URLSearchParams(params);
    Object.entries(form).forEach(([k, v]) => { if (v) p.set(k, v); });
    navigate(`/reservar/pago?${p.toString()}`);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-4xl">
          <h1 className="text-2xl font-bold text-primary mb-2">Resumen de tu reserva</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <form onSubmit={handleContinue} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-lg">Datos del conductor</h2>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Nombre *" required value={form.firstName} onChange={e => update('firstName', e.target.value)} className="px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
                <input placeholder="Apellidos *" required value={form.lastName} onChange={e => update('lastName', e.target.value)} className="px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              </div>
              <input type="email" placeholder="Email *" required value={form.email} onChange={e => update('email', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              <input type="email" placeholder="Confirmar email *" required value={form.emailConfirm} onChange={e => update('emailConfirm', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              <input type="tel" placeholder="Teléfono" value={form.phone} onChange={e => update('phone', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              <input placeholder="Nº licencia de conducir *" required value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              <input type="date" placeholder="Fecha caducidad carnet *" required value={form.licenseExpiry} onChange={e => update('licenseExpiry', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-2xl shadow-sm p-6">
                <h2 className="font-bold text-lg mb-4">Código descuento</h2>
                <div className="flex gap-2">
                  <input placeholder="Código" value={form.discountCode} onChange={e => update('discountCode', e.target.value)} className="flex-1 px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
                  <button type="button" className="px-4 py-3 bg-primary text-primary-foreground font-bold rounded-lg">Aplicar</button>
                </div>
              </div>

              <div className="bg-card rounded-2xl shadow-sm p-6 text-center">
                <p className="text-xs text-muted-foreground">Impuestos (IGIC 7%) incluidos · sin cargos ocultos</p>
              </div>

              <button type="submit" className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity">
                Continuar al pago →
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
