import { loadStripe } from '@stripe/stripe-js';

export const STRIPE_PUBLISHABLE_KEY = 'mk_1T0R75EYOQdqZYj5YdWvdJqV';
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
