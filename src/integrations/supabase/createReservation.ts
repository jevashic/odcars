import { supabase } from './client';

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
}

export async function createReservation(payload: ReservationPayload) {
  const body = {
    ...payload,
    sale_branch_id: payload.sale_branch_id || payload.pickup_branch_id,
  };

  const { data, error } = await supabase.functions.invoke('create_reservation', { body });

  if (error) {
    console.error('Error reserva:', error);
    throw new Error(error.message || 'Error al crear la reserva');
  }

  if (!data?.reservation_number) {
    console.error('Respuesta inesperada:', data);
    throw new Error('No se recibió número de reserva');
  }

  return data as { reservation_number: string };
}
