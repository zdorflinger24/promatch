import { z } from "zod";

// ─── Service Categories ─────────────────────────────────
export const SERVICE_CATEGORIES = ["plumbing", "cleaning", "handyman"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

// ─── Status Transitions ─────────────────────────────────

export const SERVICE_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "matching",
  "matched",
  "booked",
  "expired",
  "cancelled",
] as const;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;

export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "paid",
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "released_to_pro",
  "refunded",
] as const;

/** Valid service request status transitions */
export const SERVICE_REQUEST_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["matching", "cancelled"],
  matching: ["matched", "expired", "cancelled"],
  matched: ["booked", "expired", "cancelled"],
  booked: ["cancelled"],
  expired: [],
  cancelled: [],
};

/** Valid booking status transitions */
export const BOOKING_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};

/** Valid job status transitions */
export const JOB_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["in_progress"],
  in_progress: ["completed"],
  completed: ["paid"],
  paid: [],
};

/** Valid payment status transitions */
export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ["authorized"],
  authorized: ["captured", "refunded"],
  captured: ["released_to_pro", "refunded"],
  released_to_pro: [],
  refunded: [],
};

export function isValidTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

// ─── Pro Validation Schemas ─────────────────────────────

export const createProSchema = z.object({
  name: z.string().min(1).max(255),
  businessName: z.string().max(255).optional(),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  locationLat: z.string().optional(),
  locationLng: z.string().optional(),
  serviceAreaMiles: z.number().int().min(1).max(100).default(25),
  categories: z.array(z.enum(["plumbing", "cleaning", "handyman"])).min(1),
  rateRanges: z
    .record(
      z.string(),
      z.object({
        min: z.number().min(0),
        max: z.number().min(0),
        unit: z.string(),
      })
    )
    .optional(),
  availability: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))).optional(),
  bio: z.string().max(2000).optional(),
});

export const updateProSchema = createProSchema.partial().extend({
  id: z.string().uuid(),
  verified: z.boolean().optional(),
});

// ─── Matching Score Schema ──────────────────────────────

export const matchingScoreSchema = z.object({
  expertise: z.number().min(0).max(100),
  proximity: z.number().min(0).max(100),
  trackRecord: z.number().min(0).max(100),
  availability: z.number().min(0).max(100),
  priceFit: z.number().min(0).max(100),
});

export type MatchingScore = z.infer<typeof matchingScoreSchema>;

export function computeTotalScore(score: MatchingScore): number {
  const weights = {
    expertise: 0.30,
    proximity: 0.25,
    trackRecord: 0.20,
    availability: 0.15,
    priceFit: 0.10,
  };

  return (
    score.expertise * weights.expertise +
    score.proximity * weights.proximity +
    score.trackRecord * weights.trackRecord +
    score.availability * weights.availability +
    score.priceFit * weights.priceFit
  );
}

// ─── Review Validation ──────────────────────────────────

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
