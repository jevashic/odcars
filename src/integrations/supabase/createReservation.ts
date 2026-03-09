import { SUPABASE_URL, SUPABASE_ANON_KEY } from './client';

const BRANCH_MASPALOMAS = 'a58b7a55-b6a3-456a-b0f6-eed247cf3137';

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
  pickup_location_id?: string;
  return_location_id?: string;
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
  delivery_charge?: number;
  delivery_details?: any;
  discount_code?: string | null;
  notes?: string | null;
  pay_signal?: boolean;
}

export async function createReservation(payload: ReservationPayload) {
  const body = {
    ...payload,
    pickup_time: payload.start_time,
    return_time: payload.end_time,
    sale_branch_id: BRANCH_MASPALOMAS,
    pickup_branch_id: BRANCH_MASPALOMAS,
    return_branch_id: BRANCH_MASPALOMAS,
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
  console.log('Respuesta reserva:', data);

  if (data.success === true && data.data?.reservation_number) {
    return {
      reservation_number: data.data.reservation_number,
      signal_client_secret: data.data.signal_client_secret || null,
    };
  }

  console.error('Error reserva:', data);
  throw new Error(data.error || data.message || 'Error al crear la reserva');
}
