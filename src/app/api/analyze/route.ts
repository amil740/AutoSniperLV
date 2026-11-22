import { NextRequest, NextResponse } from "next/server";
import {
  cacheListing,
  getPriceComparison,
  scrapeSsLvListing,
} from "@/lib/scraper/sslv";
import { analyzeDeal } from "@/lib/ai/analyzer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string; locale?: string };
    if (!body.url) {
      return NextResponse.json(
        { error: "Listing URL is required." },
        { status: 400 },
      );
    }

    const listing = await scrapeSsLvListing(body.url);
    if (!listing.price) {
      if (body.url.toLowerCase().includes("/spare-parts/")) {
        return NextResponse.json(
          {
            error:
              "This is an ss.lv spare-parts listing, not a whole-car listing. Paste a /transport/cars/ vehicle URL.",
          },
          { status: 422 },
        );
      }
      return NextResponse.json(
        {
          error:
            "Could not detect the listing price. The ss.lv page format may have changed.",
        },
        { status: 422 },
      );
    }

    await cacheListing(listing);
    const comparison = await getPriceComparison(listing);
    const analysis = await analyzeDeal(
      listing,
      comparison,
      body.locale === "lv" || body.locale === "ru" ? body.locale : "en",
    );

    return NextResponse.json({
      listing,
      comparison,
      analysis,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze listing.";
    const lowerMessage = message.toLowerCase();
    const status =
      lowerMessage.includes("valid") ||
      lowerMessage.includes("supported") ||
      lowerMessage.includes("does not look")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
