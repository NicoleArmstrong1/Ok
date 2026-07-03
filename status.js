// api/status.js
// GET /api/status?id=CheckoutRequestID
// The frontend polls this after sending the STK push to find out whether
// the customer actually completed payment.

import { store } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  const record = store.get(id);
  if (!record) {
    return res.status(404).json({ status: "unknown" });
  }

  return res.status(200).json(record);
}
