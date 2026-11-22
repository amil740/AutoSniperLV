import { NextRequest, NextResponse } from "next/server";
import {
  getPriceComparison,
  scrapeSsLvListing,
} from "@/lib/scraper/sslv";
import { analyzeDeal } from "@/lib/ai/analyzer";

export const runtime = "nodejs";

async function telegramRequest(method: string, payload: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(`Telegram API returned ${response.status}`);
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  try {
    const update = (await request.json()) as {
      message?: {
        chat?: { id: number };
        text?: string;
      };
    };
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim();
    if (!chatId || !text) {
      return NextResponse.json({ ok: true });
    }

    if (text === "/start") {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Send me an ss.lv car listing URL and I will analyze the deal.",
      });
      return NextResponse.json({ ok: true });
    }

    const urlMatch = text.match(/https?:\/\/(?:www\.|m\.)?ss\.lv\/\S+/i);
    if (!urlMatch) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Please send a valid ss.lv car listing link.",
      });
      return NextResponse.json({ ok: true });
    }

    const listing = await scrapeSsLvListing(urlMatch[0]);
    if (!listing.price) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Could not detect a whole-car listing price.",
      });
      return NextResponse.json({ ok: true });
    }

    const comparison = await getPriceComparison(listing);
    const analysis = await analyzeDeal(listing, comparison, "lv");
    const title = [listing.make, listing.model].filter(Boolean).join(" ");
    const message = [
      `🚗 ${title || "Vehicle"}`,
      `💶 ${listing.price.toLocaleString("lv-LV")} €`,
      `📊 Deal score: ${analysis.deal_score}/10`,
      `📈 Market average: €${comparison.average.toLocaleString("lv-LV")}`,
      `\n${analysis.verdict_title}`,
    ].join("\n");

    await telegramRequest("sendPhoto", {
      chat_id: chatId,
      photo: listing.images[0] || "",
      caption: message,
    }).catch(async () => {
      await telegramRequest("sendMessage", { chat_id: chatId, text: message });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const chatId = (await request.clone().json().catch(() => null))?.message
      ?.chat?.id;
    if (chatId) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text:
          error instanceof Error
            ? `Could not analyze this listing: ${error.message}`
            : "Could not analyze this listing.",
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }
}
