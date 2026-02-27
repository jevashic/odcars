import { loadStripe } from '@stripe/stripe-js';

export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51T0R74EYOQdqZYj500exPQlF85BFAlhyQ3PknOuFQc6vQ9bhXw8OwqpUQ48rjFHZBDbEOU5pYtFw9XysOXZLOt3u00tYVE6T9E';
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
