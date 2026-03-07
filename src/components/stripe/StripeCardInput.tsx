import { CardElement } from '@stripe/react-stripe-js';

const CARD_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': { color: '#aab7c4' },
    },
  },
};

export default function StripeCardInput() {
  return (
    <div className="border border-border rounded-lg p-4 bg-background">
      <CardElement options={CARD_OPTIONS} />
    </div>
  );
}
