import axios from "axios";
import * as cheerio from "cheerio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CarListing, ComparableListing, PriceComparison } from "@/types/car";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";

function cleanText(value: string | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/\s/g, "").match(/(\d[\d.,]*)/);
  if (!match) return null;
  return Number(match[1].replace(",", ".").replace(/\.(?=\d{3}(?:\D|$))/g, ""));
}

function parseInteger(value: string | undefined): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseMileage(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d[\d\s]*\d|\d/);
  if (!match) return null;
  const mileage = Number(match[0].replace(/\s/g, ""));
  return Number.isFinite(mileage) ? mileage : null;
}

function parseLicensePlate(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = cleanText(value);
  if (/^(parādīt|показать|show)/i.test(cleaned)) return null;
  const match = cleaned.match(/[A-ZĀČĒĢĪĶĻŅŠŪŽ]{1,2}-?\d{3,4}/i);
  return match ? match[0].toUpperCase() : null;
}

function validateSsLvUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid listing URL.");
  }

  if (
    url.hostname !== "ss.lv" &&
    url.hostname !== "www.ss.lv" &&
    url.hostname !== "m.ss.lv" &&
    !url.hostname.endsWith(".ss.lv")
  ) {
    throw new Error("Only ss.lv listing URLs are supported.");
  }
  const segments = url.pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean);
  const isSsLvDetail = url.pathname.toLowerCase().endsWith(".html");
  const isCarListing =
    segments.includes("cars") &&
    (segments.includes("transport") || segments.includes("transports"));
  if (!isSsLvDetail || !isCarListing) {
    if (segments.includes("spare-parts")) {
      throw new Error(
        "This is an ss.lv spare-parts listing. Please paste a /transport/cars/ vehicle URL.",
      );
    }
    throw new Error("This does not look like an ss.lv listing.");
  }
  if (url.hostname === "m.ss.lv") {
    url.hostname = "www.ss.lv";
  }
  return url;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getTableLabels($: cheerio.CheerioAPI): Record<string, string> {
  const labels: Record<string, string> = {};

  $("tr").each((_rowIndex, row) => {
    const labelCell = $(row).children("td").filter((_index, cell) =>
      $(cell).is(".ads_opt_name, .ads_opt_name_big"),
    );
    if (!labelCell.length) return;

    const label = cleanText(labelCell.first().text())
      .replace(/:$/, "")
      .toLowerCase();
    const value = cleanText(labelCell.first().next("td").text());
    if (label && value) labels[label] = value;
  });

  return labels;
}

function findLabel(
  labels: Record<string, string>,
  aliases: string[],
): string | undefined {
  for (const alias of aliases) {
    const exact = Object.entries(labels).find(
      ([label]) => label === alias.toLowerCase(),
    );
    if (exact) return exact[1];

    const partial = Object.entries(labels).find(([label]) =>
      label.includes(alias.toLowerCase()),
    );
    if (partial) return partial[1];
  }
  return undefined;
}

export async function scrapeSsLvListing(rawUrl: string): Promise<CarListing> {
  const url = validateSsLvUrl(rawUrl);

  const response = await axios.get<ArrayBuffer>(url.toString(), {
    responseType: "arraybuffer",
    timeout: 20_000,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "lv,en;q=0.8,ru;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  const html = new TextDecoder("utf-8", { fatal: false }).decode(
    response.data,
  );
  const $ = cheerio.load(html);
  const labels = getTableLabels($);
  const images = new Set<string>();
  $('a[href*="/gallery/"], img[src*="/gallery/"], img[data-src*="/gallery/"]').each(
    (_index, element) => {
      const raw =
        $(element).attr("href") ??
        $(element).attr("src") ??
        $(element).attr("data-src");
      if (!raw) return;
      try {
        const absolute = new URL(raw, url.origin).toString();
        if (absolute.includes("/gallery/")) {
          images.add(absolute);
        }
      } catch {
        // Ignore invalid image URLs.
      }
    },
  );
  $("#msg_div_msg img, #content_main_div img, .photo_div img").each(
    (_index, image) => {
      const raw =
        $(image).attr("src") ??
        $(image).attr("data-src") ??
        $(image).attr("data-original");
      if (!raw) return;
      try {
        const absolute = new URL(raw, url.origin).toString();
        if (
          /\/img\//.test(absolute) ||
          absolute.includes("/photo/")
        ) {
          images.add(absolute);
        }
      } catch {
        // Ignore invalid image URLs.
      }
    },
  );
  if (!images.size) {
    $("img[src]").each((_index, image) => {
      const src = $(image).attr("src");
      if (!src) return;
      try {
        const absolute = new URL(src, url.origin).toString();
        if (/\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(absolute)) {
          images.add(absolute);
        }
      } catch {
        // Ignore invalid image URLs.
      }
    });
  }

  const make =
    findLabel(labels, ["marka", "марка", "make"]) ??
    $("meta[property='og:title']").attr("content")?.split(/\s+/)[0] ??
    null;
  const model =
    findLabel(labels, ["modelis", "модель", "model"]) ?? null;
  const yearValue = findLabel(labels, ["gads", "год", "year"]);
  const engine =
    findLabel(labels, [
      "motors",
      "dzinējs",
      "двигатель",
      "engine",
      "tilpums",
    ]) ?? null;
  const mileageValue = findLabel(labels, [
    "nobraukums",
    "пробег",
    "mileage",
  ]);
  const priceValue =
    findLabel(labels, ["cena", "цена", "price"]) ??
    $("meta[property='og:price:amount']").attr("content");
  const plate =
    findLabel(labels, [
      "valsts numura zīme",
      "valsts numura zime",
      "номер",
      "license plate",
    ]) ?? null;

  const descriptionCandidates = [
    "#description",
    "#msg_div_msg",
    ".msg_div_msg",
    ".td2",
    "[data-description]",
  ];
  let description = "";
  for (const selector of descriptionCandidates) {
    const container = $(selector).first().clone();
    container.find("table, script, style").remove();
    const candidate = cleanText(container.text());
    if (candidate.length > description.length) description = candidate;
  }
  if (!description) {
    description = cleanText($("main").text()).slice(0, 5000);
  }

  let parsedMake = make ? cleanText(make) : null;
  let parsedModel = model ? cleanText(model) : null;
  if (parsedMake && (!parsedModel || parsedMake.toLowerCase().includes(parsedModel.toLowerCase()))) {
    const makeParts = parsedMake.split(/\s+/);
    if (makeParts.length > 1) {
      const knownMake = makeParts.shift() ?? parsedMake;
      parsedModel = makeParts.join(" ");
      parsedMake = knownMake;
    }
  }

  return {
    url: url.toString(),
    make: parsedMake,
    model: parsedModel,
    year: parseYear(yearValue),
    mileage: parseMileage(mileageValue),
    engine: engine ? cleanText(engine) : null,
    price: parseInteger(priceValue),
    licensePlate: parseLicensePlate(plate),
    description,
    images: [...images].filter((image) => !image.includes("/img/kv")).slice(0, 12),
  };
}

export async function getPriceComparison(
  listing: CarListing,
): Promise<PriceComparison> {
  let comparables: ComparableListing[] = [];
  const supabase = createSupabaseServerClient();

  if (supabase && listing.make && listing.model) {
    const year = listing.year;
    let query = supabase
      .from("listings_cache")
      .select("id, url, make, model, year, mileage, engine, price, license_plate")
      .ilike("make", `%${listing.make}%`)
      .ilike("model", `%${listing.model}%`)
      .gt("price", 100)
      .neq("url", listing.url)
      .order("scraped_at", { ascending: false })
      .limit(30);

    if (year) {
      query = query.gte("year", year - 1).lte("year", year + 1);
    }

    const { data, error } = await query;
    if (!error && data) {
      comparables = data
        .filter((row) => typeof row.price === "number")
        .slice(0, 10)
        .map((row) => ({
          id: row.id,
          url: row.url,
          make: row.make,
          model: row.model,
          year: row.year,
          mileage: row.mileage,
          engine: row.engine,
          price: row.price,
          licensePlate: row.license_plate,
        }));
    }
  }

  if (listing.make && listing.model && comparables.length < 5) {
    try {
      const listingUrl = new URL(listing.url);
      const pathParts = listingUrl.pathname.split("/").filter(Boolean);
      const carsIndex = pathParts.findIndex((part) => part === "cars");
      if (carsIndex >= 0 && pathParts.length > carsIndex + 2) {
        const language = pathParts[0] === "msg" ? pathParts[1] : pathParts[0];
        const makeSegment = pathParts[carsIndex + 1];
        const modelSegment = pathParts[carsIndex + 2];
        const categoryUrl = `${listingUrl.origin}/${language}/transport/cars/${makeSegment}/${modelSegment}/`;
        const response = await axios.get<ArrayBuffer>(categoryUrl, {
          responseType: "arraybuffer",
          timeout: 15_000,
          headers: { "User-Agent": USER_AGENT, "Accept-Language": "lv,ru,en" },
        });
        const html = new TextDecoder("utf-8", { fatal: false }).decode(
          response.data,
        );
        const $ = cheerio.load(html);
        const seen = new Set(comparables.map((item) => item.url));
        seen.add(listing.url);
        const detailUrls: string[] = [];

        $('a[href*="/msg/"][href$=".html"]').each((_index, element) => {
          const href = $(element).attr("href");
          if (!href) return;
          const absoluteUrl = new URL(href, listingUrl.origin).toString();
          if (!seen.has(absoluteUrl) && !detailUrls.includes(absoluteUrl)) {
            detailUrls.push(absoluteUrl);
          }
        });

        const liveComparables: ComparableListing[] = [];
        for (const detailUrl of detailUrls.slice(0, 20)) {
          try {
            const liveListing = await scrapeSsLvListing(detailUrl);
            if (liveListing.price) {
              liveComparables.push({
                url: liveListing.url,
                make: liveListing.make,
                model: liveListing.model,
                year: liveListing.year,
                mileage: liveListing.mileage,
                engine: liveListing.engine,
                price: liveListing.price,
                licensePlate: liveListing.licensePlate,
              });
            }
          } catch {
            // Skip one unavailable/changed listing and continue.
          }
          if (liveComparables.length >= 20) break;
        }

        const yearMatched = listing.year
          ? liveComparables.filter(
              (item) =>
                item.year !== null &&
                Math.abs(item.year - listing.year!) <= 1,
            )
          : [];
        comparables.push(
          ...(yearMatched.length ? yearMatched : liveComparables).slice(0, 10),
        );
      }
    } catch {
      // Supabase cache remains the fallback.
    }
  }

  const prices = comparables
    .map((item) => item.price)
    .filter((price): price is number => price !== null);

  const average = prices.length
    ? prices.reduce((sum, price) => sum + price, 0) / prices.length
    : 0;
  const medianPrice = median(prices);
  const minimum = prices.length ? Math.min(...prices) : 0;
  const maximum = prices.length ? Math.max(...prices) : 0;
  const differenceEuros =
    listing.price !== null ? listing.price - average : null;
  const differencePercent =
    average && listing.price !== null
      ? ((listing.price - average) / average) * 100
      : null;

  return {
    average: Math.round(average),
    median: Math.round(medianPrice),
    minimum: Math.round(minimum),
    maximum: Math.round(maximum),
    sampleSize: prices.length,
    differenceEuros:
      differenceEuros === null ? null : Math.round(differenceEuros),
    differencePercent:
      differencePercent === null ? null : Math.round(differencePercent),
    comparables,
  };
}

export async function cacheListing(listing: CarListing): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from("listings_cache").upsert(
    {
      url: listing.url,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engine: listing.engine,
      price: listing.price,
      license_plate: listing.licensePlate,
      description: listing.description,
      scraped_at: new Date().toISOString(),
    },
    { onConflict: "url" },
  );
}
