// api/_store.js
// Shared in-memory store for tracking payment status by CheckoutRequestID.
//
// IMPORTANT: this works for a single warm serverless instance, which is
// fine for testing and low traffic, but is NOT reliable at scale — Vercel
// may spin up multiple instances, each with its own memory, so a payment
// recorded on one instance might not be visible when another instance
// handles the status check. For production, swap this for a real store:
// Vercel KV, Upstash Redis, or a database table.

if (!globalThis.__savaraPayments) {
  globalThis.__savaraPayments = new Map();
}

export const store = globalThis.__savaraPayments;
