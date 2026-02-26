import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { differenceInDays } from 'date-fns';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { supabase } from '@/integrations/supabase/client';

const EXTRAS_MAP: Record<string, { name: string; pricePerDay: number }> = {
  gps: { name: 'GPS Navegador', pricePerDay: 5 },
  'baby-seat': { name: 'Silla de bebé', pricePerDay: 7 },
};

export default function Summary() {
  const [params] = useSearchParams();
  const navigate = useLangNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', emailConfirm: '', phone: '', licenseNumber: '', licenseExpiry: '', discountCode: '' });
  const [branchName, setBranchName] = useState('');
  const [hasSurcharge, setHasSurcharge] = useState(false);

  const _categoryId = params.get('categoryId') || '';
  const paymentMode = params.get('paymentMode') || 'office';
  const startDate = params.get('pickupDate');
  const endDate = params.get('returnDate');
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;
  const extrasParam = params.get('extras') || '';
  const selectedExtras = extrasParam ? extrasParam.split(',') : [];

  const baseTotal = 39 * days; // fallback
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS_MAP[id]?.pricePerDay || 0) * days, 0);
  const surchargeAmount = hasSurcharge ? 15 : 0;
  const subtotal = baseTotal + extrasTotal + surchargeAmount;
  const discount = paymentMode === 'online' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal - discount;

  useEffect(() => {
    const pickupId = params.get('pickup');
    if (pickupId) {
      supabase.from('branches').select('name, show_surcharge_warning').eq('id', pickupId).single().then(({ data }) => {
        if (data) {
          setBranchName(data.name);
          setHasSurcharge(data.show_surcharge_warning);
        }
      });
    }
  }, [params]);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.email !== form.emailConfirm) return;
    const p = new URLSearchParams(params);
    Object.entries(form).forEach(([k, v]) => { if (v) p.set(k, v); });
    navigate(`/reservar/pago?${p.toString()}`);
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none text-sm';

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-4xl">
          <h1 className="text-2xl font-bold text-primary mb-2">Resumen de tu reserva</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <form onSubmit={handleContinue} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* Left: form */}
            <div className="bg-card rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-lg">Datos del conductor</h2>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Nombre *" required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} />
                <input placeholder="Apellidos *" required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} />
              </div>
              <input type="email" placeholder="Email *" required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} />
              <input type="email" placeholder="Confirmar email *" required value={form.emailConfirm} onChange={e => update('emailConfirm', e.target.value)} className={inputCls} />
              <input type="tel" placeholder="Teléfono" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls} />
              <input placeholder="Nº licencia de conducir *" required value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} className={inputCls} />
              <input type="date" placeholder="Fecha caducidad carnet *" required value={form.licenseExpiry} onChange={e => update('licenseExpiry', e.target.value)} className={inputCls} />

              <div>
                <h2 className="font-bold text-lg mt-4 mb-2">Código descuento</h2>
                <div className="flex gap-2">
                  <input placeholder="Código" value={form.discountCode} onChange={e => update('discountCode', e.target.value)} className={`flex-1 ${inputCls}`} />
                  <button type="button" className="px-4 py-3 bg-primary text-primary-foreground font-bold rounded-lg text-sm">Aplicar</button>
                </div>
              </div>
            </div>

            {/* Right: breakdown */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl shadow-sm p-6">
                <h2 className="font-bold text-lg mb-4">Desglose</h2>
                {branchName && (
                  <p className="text-xs text-muted-foreground mb-3">📍 {branchName}</p>
                )}
                {startDate && endDate && (
                  <p className="text-xs text-muted-foreground mb-4">
                    {format(new Date(startDate), 'dd/MM/yyyy')} → {format(new Date(endDate), 'dd/MM/yyyy')} · {days} día{days > 1 ? 's' : ''}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Alquiler ({days} días)</span>
                    <span className="font-medium">{baseTotal} €</span>
                  </div>
                  {selectedExtras.map(id => EXTRAS_MAP[id] && (
                    <div key={id} className="flex justify-between">
                      <span>{EXTRAS_MAP[id].name}</span>
                      <span className="font-medium">{EXTRAS_MAP[id].pricePerDay * days} €</span>
                    </div>
                  ))}
                  {hasSurcharge && (
                    <div className="flex justify-between text-cta">
                      <span>Suplemento entrega</span>
                      <span className="font-medium">{surchargeAmount} €</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Descuento online (−15%)</span>
                      <span className="font-medium">−{discount} €</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-primary">{total} €</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 text-center">IGIC (7%) incluido · Sin cargos ocultos</p>
              </div>

              <button type="submit" className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity">
                Ir al pago →
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
