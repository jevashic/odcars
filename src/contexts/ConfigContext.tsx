import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppConfig {
  insurance_model: string;
  insurance_premium_supplement: number;
  deposit_amount_default: number;
  cancellation_free_hours: number;
  show_chat: boolean;
  company_name: string;
  company_phone: string;
  company_email: string;
}

const defaults: AppConfig = {
  insurance_model: 'premium_included',
  insurance_premium_supplement: 0,
  deposit_amount_default: 0,
  cancellation_free_hours: 48,
  show_chat: true,
  company_name: 'Ocean Drive Rent a Car',
  company_phone: '+34 928 000 000',
  company_email: 'info@oceandrive.es',
};

const ConfigContext = createContext<AppConfig>(defaults);
export const useConfig = () => useContext(ConfigContext);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaults);

  useEffect(() => {
    supabase.from('public_config').select('*').single().then(({ data }) => {
      if (data) {
        setConfig({
          insurance_model: data.insurance_model ?? defaults.insurance_model,
          insurance_premium_supplement: data.insurance_premium_supplement ?? 0,
          deposit_amount_default: data.deposit_amount_default ?? 0,
          cancellation_free_hours: data.cancellation_free_hours ?? 48,
          show_chat: data.show_chat === true || data.show_chat === 'true',
          company_name: data.company_name ?? defaults.company_name,
          company_phone: data.company_phone ?? defaults.company_phone,
          company_email: data.company_email ?? defaults.company_email,
        });
        const root = document.documentElement;
        if (data.color_primary) root.style.setProperty('--color-primary-brand', data.color_primary);
        if (data.color_cta) root.style.setProperty('--color-cta-brand', data.color_cta);
      }
    });
  }, []);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}
