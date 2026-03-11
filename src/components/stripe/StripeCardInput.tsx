import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';

const ELEMENT_OPTIONS = {
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
    <div className="flex flex-col gap-3">
      <div className="border border-border rounded-lg p-4 bg-background">
        <CardNumberElement options={ELEMENT_OPTIONS} />
      </div>
      <div className="flex flex-row gap-3">
        <div className="w-1/2 border border-border rounded-lg p-4 bg-background">
          <CardExpiryElement options={ELEMENT_OPTIONS} />
        </div>
        <div className="w-1/2 border border-border rounded-lg p-4 bg-background">
          <CardCvcElement options={ELEMENT_OPTIONS} />
        </div>
      </div>
    </div>
  );
}
