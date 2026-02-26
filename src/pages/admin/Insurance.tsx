import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type InsuranceModel = 'premium_included' | 'basic_included';

interface InsuranceConfig {
  insurance_model: InsuranceModel;
  insurance_premium_supplement: number;
  deposit_amount_default: number;
}

const defaults: InsuranceConfig = {
  insurance_model: 'premium_included',
  insurance_premium_supplement: 0,
  deposit_amount_default: 0,
};

export default function AdminInsurance() {
  const [config, setConfig] = useState<InsuranceConfig>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('public_config').select('insurance_model, insurance_premium_supplement, deposit_amount_default').single().then(({ data }) => {
      if (data) {
        setConfig({
          insurance_model: (data.insurance_model as InsuranceModel) ?? defaults.insurance_model,
          insurance_premium_supplement: Number(data.insurance_premium_supplement) || 0,
          deposit_amount_default: Number(data.deposit_amount_default) || 0,
        });
      }
      setLoaded(true);
    });
  }, []);

  const selectModel = (model: InsuranceModel) => {
    if (model === 'premium_included') {
      setConfig({ insurance_model: model, insurance_premium_supplement: 0, deposit_amount_default: 0 });
    } else {
      setConfig((prev) => ({ ...prev, insurance_model: model }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // public_config is a single-row table
    const { error } = await supabase
      .from('public_config')
      .update({
        insurance_model: config.insurance_model,
        insurance_premium_supplement: config.insurance_premium_supplement,
        deposit_amount_default: config.deposit_amount_default,
      })
      .not('insurance_model', 'is', null); // match the single row

    if (error) {
      toast.error('Error al guardar: ' + error.message);
      setSaving(false);
      return;
    }

    toast.success('Configuración de seguros guardada correctamente');
    setSaving(false);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const isPremium = config.insurance_model === 'premium_included';

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-2">Seguros</h1>
      <p className="text-muted-foreground text-sm mb-8">Elige el modelo de seguro que se aplica a todas las reservas.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Model A – Premium included */}
        <button
          type="button"
          onClick={() => selectModel('premium_included')}
          className={`relative text-left rounded-xl border-2 p-6 transition-all ${
            isPremium
              ? 'border-emerald-500 bg-emerald-50 shadow-md'
              : 'border-border bg-white hover:border-muted-foreground/30'
          }`}
        >
          {isPremium && (
            <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
              Activo
            </span>
          )}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Modelo A — Premium Incluido</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Seguro a todo riesgo incluido</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> 0 € de fianza</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Sin suplementos de seguro</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Mayor conversión y confianza</li>
          </ul>
        </button>

        {/* Model B – Basic included */}
        <button
          type="button"
          onClick={() => selectModel('basic_included')}
          className={`relative text-left rounded-xl border-2 p-6 transition-all ${
            !isPremium
              ? 'border-cta bg-cta/5 shadow-md'
              : 'border-border bg-white hover:border-muted-foreground/30'
          }`}
        >
          {!isPremium && (
            <span className="absolute top-3 right-3 bg-cta text-cta-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
              Activo
            </span>
          )}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-cta/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-cta" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Modelo B — Básico Incluido</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cta" /> Seguro básico incluido (CDW)</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cta" /> Premium disponible como extra</li>
            <li className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-cta" /> Requiere fianza configurable</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cta" /> Precio base más competitivo</li>
          </ul>
        </button>
      </div>

      {/* Model B config fields */}
      {!isPremium && (
        <div className="bg-white rounded-xl border border-border p-6 mb-8 max-w-lg">
          <h3 className="font-bold text-foreground mb-4">Configuración Modelo B</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Suplemento seguro premium (€/día)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={config.insurance_premium_supplement}
                onChange={(e) => setConfig((p) => ({ ...p, insurance_premium_supplement: Number(e.target.value) }))}
                className="w-full px-4 py-2.5 rounded-lg border border-border focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fianza por defecto (€)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={config.deposit_amount_default}
                onChange={(e) => setConfig((p) => ({ ...p, deposit_amount_default: Number(e.target.value) }))}
                className="w-full px-4 py-2.5 rounded-lg border border-border focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-cta text-cta-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
}
