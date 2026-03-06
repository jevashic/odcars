import { SUPABASE_URL, SUPABASE_ANON_KEY } from './client';

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
  vehicle_id?: string;
  pickup_branch_id: string;
  return_branch_id: string;
  sale_branch_id?: string;
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
  pickup_location_id?: string;
  return_location_id?: string;
  delivery_charge?: number;
  delivery_details?: any;
  discount_code?: string | null;
  notes?: string | null;
}

export async function createReservation(payload: ReservationPayload) {
  const body = {
    ...payload,
    sale_branch_id: payload.sale_branch_id || payload.pickup_branch_id,
  };

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create_reservation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.reservation_number) {
    console.error('Error reserva:', data);
    throw new Error(data.error || data.message || 'Error al crear la reserva');
  }

  return data as { reservation_number: string };
}
