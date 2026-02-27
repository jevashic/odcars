import { supabase } from './client';

const FUNCTION_URL = 'https://sqmganbjiisitgumsztv.supabase.co/functions/v1/create_reservation';

export interface ReservationPayload {
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    license_number: string;
    license_expiry: string;
  };
  category_id: string;
  pickup_branch_id: string;
  return_branch_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  insurance_tier: string;
  extra_ids: string[];
  payment_method: 'card_online' | 'card_office';
  stripe_payment_intent_id?: string;
  stripe_setup_intent_id?: string;
  sale_channel: string;
}

export async function createReservation(payload: ReservationPayload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || '';

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || err.message || `Error ${res.status}`);
  }

  return res.json() as Promise<{ reservation_number: string }>;
}
