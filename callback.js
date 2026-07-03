// api/callback.js
// Vercel serverless function: POST /api/callback
// Safaricom calls THIS endpoint (not your browser) once the customer
// enters their PIN or cancels. Must be a public HTTPS URL — set it as
// MPESA_CALLBACK_URL in your env vars, matching this route's deployed URL.

import { store } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const body = req.body;
    const result = body?.Body?.stkCallback;

    if (!result) {
      return res.status(400).json({ error: "Unexpected payload" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = result;
    const existing = store.get(CheckoutRequestID) || {};

    if (ResultCode === 0) {
      // Payment succeeded — pull out the details M-Pesa sends back
      const items = CallbackMetadata?.Item || [];
      const get = (name) => items.find((i) => i.Name === name)?.Value;

      const paymentRecord = {
        ...existing,
        status: "success",
        mpesaReceipt: get("MpesaReceiptNumber"),
        confirmedAmount: get("Amount"),
        transactionDate: get("TransactionDate"),
      };

      store.set(CheckoutRequestID, paymentRecord);
      // TODO: also save paymentRecord to a real database, activate the
      // subscription, send a confirmation SMS/WhatsApp, etc.
      console.log("Payment successful:", paymentRecord);
    } else {
      // Payment failed or was cancelled by the customer
      store.set(CheckoutRequestID, { ...existing, status: "failed", reason: ResultDesc });
      console.log("Payment not completed:", CheckoutRequestID, ResultDesc);
    }

    // Always acknowledge receipt so Safaricom stops retrying
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
