import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { vin?: string; plate?: string };
    const vin = body.vin?.trim();
    const plate = body.plate?.trim();

    if (!vin && !plate) {
      return NextResponse.json(
        { error: "Enter a VIN or Latvian registration plate." },
        { status: 400 },
      );
    }

    const apiUrl = process.env.CSDD_API_URL;
    const apiKey = process.env.CSDD_API_KEY;
    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        {
          error:
            "CSDD API is not configured. A commercial CSDD API contract and credentials are required.",
          openUrl: "https://e.csdd.lv/chkta?lng=en",
          vin: vin ?? null,
          plate: plate ?? null,
        },
        { status: 503 },
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...(vin ? { vin } : {}),
        ...(plate ? { registrationNumber: plate } : {}),
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as unknown;
    if (!response.ok) {
      return NextResponse.json(
        { error: "CSDD API request failed.", details: data },
        { status: response.status },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not query CSDD.",
      },
      { status: 500 },
    );
  }
}
