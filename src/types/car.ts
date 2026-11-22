export type CarListing = {
  url: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  engine: string | null;
  price: number | null;
  licensePlate: string | null;
  description: string;
  images: string[];
};

export type ComparableListing = {
  id?: string;
  url: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  engine: string | null;
  price: number | null;
  licensePlate: string | null;
};

export type PriceComparison = {
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  sampleSize: number;
  differenceEuros: number | null;
  differencePercent: number | null;
  comparables: ComparableListing[];
};

export type DealAnalysis = {
  deal_score: number;
  verdict_title: string;
  pros: string[];
  red_flags: string[];
  csdd_check_url: string;
};
