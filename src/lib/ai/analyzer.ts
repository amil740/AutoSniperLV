import OpenAI from "openai";
import type {
  CarListing,
  DealAnalysis,
  PriceComparison,
} from "@/types/car";

export async function analyzeDeal(
  listing: CarListing,
  comparison: PriceComparison,
  locale: "en" | "lv" | "ru" = "en",
): Promise<DealAnalysis> {
  const fallback: DealAnalysis = {
    deal_score: 5,
    verdict_title: "AI analysis unavailable",
    pros: [],
    red_flags: [
      "Verify the listing independently",
      "Request CSDD history and inspect the vehicle",
    ],
    csdd_check_url: "https://csdd.lv/",
  };

  if (!process.env.OPENAI_API_KEY) return fallback;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = [
    `Write verdict_title, pros and red_flags in ${locale === "lv" ? "Latvian" : locale === "ru" ? "Russian" : "English"}.`,
    "Analyze this Latvian/Russian-used car listing for a Latvian buyer.",
    "Return only valid JSON, with keys deal_score, verdict_title, pros, red_flags, csdd_check_url.",
    "deal_score must be an integer from 1 to 10.",
    "verdict_title should be concise and in English or Latvian.",
    "Pros/red_flags should be short strings.",
    "For csdd_check_url use https://csdd.lv/.",
    "Flag suspiciously low mileage, vague history, imported explanations, repair words, accident terms, pressure tactics, mismatched equipment, or price inconsistency.",
    "",
    `Listing: ${JSON.stringify(listing)}`,
    `Price comparison: ${JSON.stringify(comparison)}`,
  ].join("\n");

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
  });

  try {
    const text = response.output_text.replace(/```(?:json)?|```/g, "").trim();
    const parsed = JSON.parse(text) as Partial<DealAnalysis>;
    return {
      deal_score: Math.max(
        1,
        Math.min(10, Math.round(Number(parsed.deal_score) || 5)),
      ),
      verdict_title:
        typeof parsed.verdict_title === "string"
          ? parsed.verdict_title
          : fallback.verdict_title,
      pros: Array.isArray(parsed.pros)
        ? parsed.pros.filter((item): item is string => typeof item === "string")
        : [],
      red_flags: Array.isArray(parsed.red_flags)
        ? parsed.red_flags.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      csdd_check_url: "https://csdd.lv/",
    };
  } catch {
    return fallback;
  }
}
