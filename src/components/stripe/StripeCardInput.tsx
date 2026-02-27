import { CardElement } from '@stripe/react-stripe-js';

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#333333',
      '::placeholder': { color: '#9CA3AF' },
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
