"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Gauge,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Zap,
} from "lucide-react";
import type {
  CarListing,
  DealAnalysis,
  PriceComparison,
} from "@/types/car";

type AnalysisResponse = {
  listing: CarListing;
  comparison: PriceComparison;
  analysis: DealAnalysis;
};

const copy = {
  lv: {
    alerts: "Medību brīdinājumi",
    subscribe: "Abonēt",
    tag: "Latvijas tirgus analītika",
    headline1: "Atrast pārmaksātus auto.",
    headline2: "Iegūt labākos piedāvājumus.",
    sub: "Ielīmē ss.lv sludinājumu, salīdzini tirgus cenu un saņem AI pircēja vērtējumu.",
    placeholder: "https://www.ss.lv/lv/transport/cars/...",
    analyze: "Analizēt piedāvājumu",
    scanning: "Skenē...",
    detected: "Atrasts sludinājums",
    unknown: "Nezināms transportlīdzeklis",
    year: "Izlaiduma gads",
    mileage: "Nobraukums",
    engine: "Motors",
    plate: "Valsts numurs",
    notVisible: "Nav redzams",
    price: "Pieprasītā cena",
    average: "Tirgus vidējā cena",
    cheaper: "Lētāk",
    expensive: "Dārgāk",
    noComparables: "Salīdzināmi sludinājumi vēl nav atrasti.",
    pros: "Priekšrocības",
    redFlags: "Brīdinājumi",
    checkHistory: "Pārbaudīt CSDD",
    csddText: "Pārbaudi īpašumtiesības un tehnisko statusu",
  },
  en: {
    alerts: "Sniper Alerts",
    subscribe: "Subscribe",
    tag: "Latvian market intelligence",
    headline1: "Find overpriced cars.",
    headline2: "Snipe the best deals.",
    sub: "Paste an ss.lv listing to compare market value and get an AI-powered buyer verdict.",
    placeholder: "https://www.ss.lv/lv/transport/cars/...",
    analyze: "Analyze Deal",
    scanning: "Scanning...",
    detected: "Detected listing",
    unknown: "Unknown vehicle",
    year: "Year",
    mileage: "Mileage",
    engine: "Engine",
    plate: "License plate",
    notVisible: "Not visible",
    price: "Asking price",
    average: "Market average",
    cheaper: "Cheaper",
    expensive: "Expensive",
    noComparables: "No comparable listings in the cache yet.",
    pros: "Pros",
    redFlags: "Red flags",
    checkHistory: "Check vehicle history",
    csddText: "CSDD: ownership and technical status",
  },
  ru: {
    alerts: "Снайпер-сигналы",
    subscribe: "Подписка",
    tag: "Аналитика рынка Латвии",
    headline1: "Найди завышенные цены.",
    headline2: "Лови лучшие предложения.",
    sub: "Вставь ссылку ss.lv, сравни рыночную цену и получи анализ для покупателя.",
    placeholder: "https://www.ss.lv/lv/transport/cars/...",
    analyze: "Анализировать",
    scanning: "Сканирование...",
    detected: "Найденное объявление",
    unknown: "Неизвестный автомобиль",
    year: "Год",
    mileage: "Пробег",
    engine: "Двигатель",
    plate: "Номер",
    notVisible: "Не указан",
    price: "Запрашиваемая цена",
    average: "Средняя цена",
    cheaper: "Дешевле",
    expensive: "Дороже",
    noComparables: "Сравнимые объявления пока не найдены.",
    pros: "Плюсы",
    redFlags: "Красные флаги",
    checkHistory: "Проверить CSDD",
    csddText: "Проверка владельцев и технического статуса",
  },
} as const;

export default function Home() {
  const [locale, setLocale] = useState<"lv" | "ru" | "en">("lv");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [historyIdentifier, setHistoryIdentifier] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyOpenUrl, setHistoryOpenUrl] = useState("");
  const t = copy[locale];

  async function analyze() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, locale }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Analysis failed.",
      );
    } finally {
      setLoading(false);
    }

  }

  async function checkHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryOpenUrl("");
    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: historyIdentifier,
          vin: historyIdentifier,
        }),
      });
      const data = await response.json();
      if (data.openUrl) setHistoryOpenUrl(data.openUrl);
      if (!response.ok) throw new Error(data.error || "Could not check history.");
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not check history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      user_contact: String(form.get("contact") ?? ""),
      make: String(form.get("make") ?? ""),
      model: String(form.get("model") ?? ""),
      min_year: Number(form.get("min_year")) || undefined,
      max_price: Number(form.get("max_price")) || undefined,
    };

    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setAlertSaved(true);
    } else {
      const data = await response.json();
      setError(data.error || "Could not save alert.");
    }

  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start checkout.");
      window.location.assign(data.url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not start checkout.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  const gaugePosition =
    result?.comparison.average && result.listing.price
      ? Math.max(
          5,
          Math.min(
            95,
            50 +
              ((result.listing.price - result.comparison.average) /
                Math.max(result.comparison.maximum, 1)) *
                100,
          ),
        )
      : 50;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-6">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <Crosshair className="h-6 w-6 text-lime" />
          <span>AutoSniper <span className="text-lime">LV</span></span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={locale}
            onChange={(event) =>
              setLocale(event.target.value as "lv" | "ru" | "en")
            }
            aria-label="Language"
            className="h-9 rounded-full border border-white/10 bg-panel px-2 text-xs outline-none"
          >
            <option value="lv">LV</option>
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
          <button
            onClick={() => void startCheckout()}
            disabled={checkoutLoading}
            className="hidden items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-2 text-sm text-lime sm:flex"
          >
            <Zap className="h-4 w-4" />
            {checkoutLoading ? "..." : t.subscribe}
          </button>
          <button
            onClick={() => setShowAlert(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:border-lime/50"
          >
            <Zap className="h-4 w-4 text-lime" />
            {t.alerts}
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl pb-10 pt-20 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          <Target className="h-3.5 w-3.5" />
          {t.tag}
        </div>
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">
          {t.headline1}
          <br />
          <span className="text-lime">{t.headline2}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
          {t.sub}
        </p>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-panel p-2 shadow-2xl sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <Search className="h-5 w-5 shrink-0 text-slate-500" />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void analyze();
              }}
              placeholder={t.placeholder}
              className="h-12 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => void analyze()}
            disabled={loading || !url.trim()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-6 font-bold text-slate-950 transition hover:bg-[#83d8c7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Crosshair className="h-5 w-5" />
            )}
            {loading ? t.scanning : t.analyze}
          </button>
        </div>
        {error && (
          <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>

      {result && (
        <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-white/10 bg-panel p-5 sm:p-6">
            {result.listing.images?.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {result.listing.images.slice(0, 3).map((image) => (
                  // SS.LV serves both JPG and WebP listing images.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image}
                    src={image}
                    alt=""
                    className="h-32 w-full rounded-xl border border-white/5 object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{t.detected}</p>
                <h2 className="mt-1 text-2xl font-bold">
                  {[result.listing.make, result.listing.model]
                    .filter(Boolean)
                    .join(" ") || t.unknown}
                </h2>
              </div>
              <div className="rounded-xl bg-lime px-3 py-2 text-right text-slate-950">
                <p className="text-[10px] font-bold uppercase">Deal Score</p>
                <p className="text-2xl font-black">
                  {result.analysis.deal_score}/10
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t.year, result.listing.year ?? "—"],
                [
                  t.mileage,
                  result.listing.mileage
                    ? `${result.listing.mileage.toLocaleString()} km`
                    : "—",
                ],
                [t.engine, result.listing.engine ?? "—"],
                [t.plate, result.listing.licensePlate ?? t.notVisible],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/5 bg-black/20 p-3"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t.price}</p>
                  <p className="mt-1 text-3xl font-black">
                    €{result.listing.price?.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{t.average}</p>
                  <p className="mt-1 text-xl font-bold">
                    €{result.comparison.average.toLocaleString()}
                  </p>
                </div>
              </div>
              {result.comparison.sampleSize > 0 ? (
                <>
                  <div className="mt-6 h-2 rounded-full bg-gradient-to-r from-lime via-slate-500 to-red-400">
                    <div
                      className="relative h-5 w-1 -translate-y-1.5 bg-white shadow"
                      style={{ left: `${gaugePosition}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{t.cheaper}</span>
                    <span>{t.average}</span>
                    <span>{t.expensive}</span>
                  </div>
                </>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  {t.noComparables}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-lime/20 bg-lime/[0.04] p-5">
              <div className="flex items-center gap-2 text-lime">
                <Gauge className="h-5 w-5" />
                <h3 className="font-bold">{result.analysis.verdict_title}</h3>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t.pros}
                  </p>
                  {result.analysis.pros.map((item) => (
                    <p key={item} className="mt-2 text-sm text-slate-300">
                      {item}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t.redFlags}
                  </p>
                  {result.analysis.red_flags.map((item) => (
                    <p key={item} className="mt-2 text-sm text-slate-300">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-panel p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-lime" />
                <div>
                  <p className="font-bold">{t.checkHistory}</p>
                  <p className="text-xs text-slate-500">{t.csddText}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={historyIdentifier}
                  onChange={(event) => setHistoryIdentifier(event.target.value)}
                  placeholder={
                    result.listing.licensePlate
                      ? result.listing.licensePlate
                      : "Plate or VIN"
                  }
                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                />
                <button
                  type="button"
                  onClick={() => void checkHistory()}
                  disabled={historyLoading || !historyIdentifier.trim()}
                  className="rounded-xl bg-lime px-4 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {historyLoading ? "..." : "Check"}
                </button>
              </div>
              {historyError && (
                <p className="mt-3 text-xs text-amber-300">{historyError}</p>
              )}
              {historyOpenUrl && (
                <a
                  href={historyOpenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-1 text-xs text-lime"
                >
                  Open official e-CSDD <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {showAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAlert(false);
          }}
        >
          <form
            onSubmit={saveAlert}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-lime">
                  Sniper Alert
                </p>
                <h2 className="mt-1 text-xl font-bold">Track a deal profile</h2>
              </div>
              <SlidersHorizontal className="h-5 w-5 text-slate-500" />
            </div>

            {alertSaved ? (
              <div className="mt-6 rounded-xl border border-lime/20 bg-lime/5 p-4 text-sm text-lime">
                Alert saved successfully.
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                <input
                  name="contact"
                  required
                  placeholder="Telegram username or Email"
                  className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="make"
                    placeholder="Make (BMW)"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                  />
                  <input
                    name="model"
                    placeholder="Model (X5)"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="min_year"
                    type="number"
                    placeholder="Minimum year"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                  />
                  <input
                    name="max_price"
                    type="number"
                    placeholder="Maximum €"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime/50"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-2 h-11 rounded-xl bg-lime font-bold text-slate-950"
                >
                  Save Alert
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
