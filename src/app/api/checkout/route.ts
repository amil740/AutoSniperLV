import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin;

  if (!secretKey || !priceId) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID.",
      },
      { status: 503 },
    );
  }

  const stripe = new Stripe(secretKey);
  const body = (await request.json().catch(() => ({}))) as {
    customer_email?: string;
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: body.customer_email || undefined,
    success_url: `${appUrl}/?subscription=success`,
    cancel_url: `${appUrl}/?subscription=cancelled`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: session.url });
}
