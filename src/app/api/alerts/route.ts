import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      user_contact?: string;
      make?: string;
      model?: string;
      min_year?: number;
      max_price?: number;
    };

    const userContact = body.user_contact?.trim();
    if (!userContact) {
      return NextResponse.json(
        { error: "Telegram username or email is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    const { error } = await supabase.from("alerts").insert({
      user_contact: userContact,
      make: body.make?.trim() || null,
      model: body.model?.trim() || null,
      min_year: body.min_year || null,
      max_price: body.max_price || null,
      is_active: true,
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save alert.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
