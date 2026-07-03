// api/stkpush.js
// Vercel serverless function: POST /api/stkpush
// Body: { phone: "0718020829", amount: 2000, planName: "15 Mbps" }
//
// This is the ONLY safe place for your Daraja credentials to live —
// never put consumer key/secret in the frontend HTML.

import { store } from "./_store.js";

const BASE_URL = process.env.MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function normalizePhone(raw) {
  // Accepts 07xxxxxxxx or 01xxxxxxxx or 2547xxxxxxxx, returns 2547xxxxxxxx
  let p = raw.replace(/\s+/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const creds = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error("Failed to get M-Pesa access token");
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { phone, amount, planName } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ error: "phone and amount are required" });
    }

    const shortcode = process.env.MPESA_SHORTCODE;      // your paybill/till number
    const passkey = process.env.MPESA_PASSKEY;
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
    const partyPhone = normalizePhone(phone);

    const accessToken = await getAccessToken();

    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: partyPhone,
        PartyB: shortcode,
        PhoneNumber: partyPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL, // e.g. https://yourdomain.com/api/callback
        AccountReference: planName ? `Savara-${planName}` : "Savara Fibre",
        TransactionDesc: "Savara Fibre subscription payment",
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok) {
      return res.status(stkRes.status).json({ error: "STK push failed", details: stkData });
    }

    // Record it as pending so /api/status has something to report while
    // we wait for Safaricom to call /api/callback with the real result.
    store.set(stkData.CheckoutRequestID, {
      status: "pending",
      phone: partyPhone,
      amount,
      planName,
      createdAt: Date.now(),
    });

    return res.status(200).json({
      message: "STK push sent",
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error initiating payment" });
  }
}
