import { describe, it, expect } from "vitest";
import {
  createProSchema,
  updateProSchema,
  matchingScoreSchema,
  computeTotalScore,
  isValidRating,
  isValidTransition,
  SERVICE_REQUEST_TRANSITIONS,
  BOOKING_TRANSITIONS,
  JOB_TRANSITIONS,
  PAYMENT_TRANSITIONS,
} from "../lib/validations";

// =============================================================================
// Pro Creation Schema
// =============================================================================

describe("createProSchema", () => {
  const validPro = {
    name: "John Smith",
    email: "john@example.com",
    categories: ["plumbing"] as const,
  };

  it("accepts valid minimal pro data", () => {
    const result = createProSchema.safeParse(validPro);
    expect(result.success).toBe(true);
  });

  it("accepts valid full pro data", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      businessName: "Smith Plumbing LLC",
      phone: "214-555-0100",
      address: "123 Main St, Dallas, TX 75201",
      locationLat: "32.7767",
      locationLng: "-96.7970",
      serviceAreaMiles: 30,
      categories: ["plumbing", "handyman"],
      rateRanges: {
        plumbing: { min: 75, max: 150, unit: "hour" },
      },
      availability: {
        monday: [["09:00", "17:00"]],
        tuesday: [["09:00", "12:00"], ["13:00", "17:00"]],
      },
      bio: "Licensed plumber with 15 years of experience in the DFW area.",
    });
    expect(result.success).toBe(true);
  });

  it("defaults serviceAreaMiles to 25", () => {
    const result = createProSchema.parse(validPro);
    expect(result.serviceAreaMiles).toBe(25);
  });

  // Name validation
  it("rejects empty name", () => {
    const result = createProSchema.safeParse({ ...validPro, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = createProSchema.safeParse({ ...validPro, name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  // Email validation
  it("rejects invalid email", () => {
    const result = createProSchema.safeParse({ ...validPro, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email, ...noemail } = validPro;
    const result = createProSchema.safeParse(noemail);
    expect(result.success).toBe(false);
  });

  // Categories validation
  it("rejects empty categories", () => {
    const result = createProSchema.safeParse({ ...validPro, categories: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      categories: ["electrician"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid categories", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      categories: ["plumbing", "cleaning", "handyman"],
    });
    expect(result.success).toBe(true);
  });

  // Service area validation
  it("rejects serviceAreaMiles below 1", () => {
    const result = createProSchema.safeParse({ ...validPro, serviceAreaMiles: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects serviceAreaMiles above 100", () => {
    const result = createProSchema.safeParse({ ...validPro, serviceAreaMiles: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer serviceAreaMiles", () => {
    const result = createProSchema.safeParse({ ...validPro, serviceAreaMiles: 25.5 });
    expect(result.success).toBe(false);
  });

  // Bio validation
  it("rejects bio exceeding 2000 characters", () => {
    const result = createProSchema.safeParse({ ...validPro, bio: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  // Rate ranges validation
  it("rejects negative rate min", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      rateRanges: { plumbing: { min: -10, max: 100, unit: "hour" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative rate max", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      rateRanges: { plumbing: { min: 0, max: -5, unit: "hour" } },
    });
    expect(result.success).toBe(false);
  });

  // Phone validation
  it("rejects phone exceeding 20 characters", () => {
    const result = createProSchema.safeParse({
      ...validPro,
      phone: "1".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Pro Update Schema
// =============================================================================

describe("updateProSchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateProSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts id with only verified update", () => {
    const result = updateProSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      verified: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const result = updateProSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Updated Name",
    });
    expect(result.success).toBe(true);
  });

  it("validates fields when present", () => {
    const result = updateProSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      email: "not-valid",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Matching Score
// =============================================================================

describe("matchingScoreSchema", () => {
  const validScore = {
    expertise: 85,
    proximity: 90,
    trackRecord: 70,
    availability: 95,
    priceFit: 80,
  };

  it("accepts valid scores", () => {
    const result = matchingScoreSchema.safeParse(validScore);
    expect(result.success).toBe(true);
  });

  it("rejects negative scores", () => {
    const result = matchingScoreSchema.safeParse({ ...validScore, expertise: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects scores above 100", () => {
    const result = matchingScoreSchema.safeParse({ ...validScore, proximity: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values (0 and 100)", () => {
    const result = matchingScoreSchema.safeParse({
      expertise: 0,
      proximity: 100,
      trackRecord: 0,
      availability: 100,
      priceFit: 50,
    });
    expect(result.success).toBe(true);
  });
});

describe("computeTotalScore", () => {
  it("computes weighted total correctly", () => {
    const score = {
      expertise: 100,    // weight 0.30 → 30
      proximity: 100,    // weight 0.25 → 25
      trackRecord: 100,  // weight 0.20 → 20
      availability: 100, // weight 0.15 → 15
      priceFit: 100,     // weight 0.10 → 10
    };
    expect(computeTotalScore(score)).toBe(100);
  });

  it("returns 0 for all-zero scores", () => {
    const score = {
      expertise: 0,
      proximity: 0,
      trackRecord: 0,
      availability: 0,
      priceFit: 0,
    };
    expect(computeTotalScore(score)).toBe(0);
  });

  it("weights expertise highest", () => {
    const expertiseOnly = {
      expertise: 100,
      proximity: 0,
      trackRecord: 0,
      availability: 0,
      priceFit: 0,
    };
    const proximityOnly = {
      expertise: 0,
      proximity: 100,
      trackRecord: 0,
      availability: 0,
      priceFit: 0,
    };
    expect(computeTotalScore(expertiseOnly)).toBeGreaterThan(
      computeTotalScore(proximityOnly)
    );
  });

  it("weights priceFit lowest", () => {
    const priceFitOnly = {
      expertise: 0,
      proximity: 0,
      trackRecord: 0,
      availability: 0,
      priceFit: 100,
    };
    expect(computeTotalScore(priceFitOnly)).toBe(10);
  });

  it("computes a realistic mixed score", () => {
    const score = {
      expertise: 85,    // 85 * 0.30 = 25.5
      proximity: 90,    // 90 * 0.25 = 22.5
      trackRecord: 70,  // 70 * 0.20 = 14.0
      availability: 95, // 95 * 0.15 = 14.25
      priceFit: 80,     // 80 * 0.10 = 8.0
    };
    const expected = 25.5 + 22.5 + 14.0 + 14.25 + 8.0;
    expect(computeTotalScore(score)).toBeCloseTo(expected, 5);
  });
});

// =============================================================================
// Review Rating
// =============================================================================

describe("isValidRating", () => {
  it("accepts ratings 1-5", () => {
    for (let i = 1; i <= 5; i++) {
      expect(isValidRating(i)).toBe(true);
    }
  });

  it("rejects rating 0", () => {
    expect(isValidRating(0)).toBe(false);
  });

  it("rejects rating 6", () => {
    expect(isValidRating(6)).toBe(false);
  });

  it("rejects non-integer ratings", () => {
    expect(isValidRating(3.5)).toBe(false);
  });

  it("rejects negative ratings", () => {
    expect(isValidRating(-1)).toBe(false);
  });
});

// =============================================================================
// Status Transitions — Service Request
// =============================================================================

describe("Service Request status transitions", () => {
  it("allows draft → submitted", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "draft", "submitted")).toBe(true);
  });

  it("allows draft → cancelled", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "draft", "cancelled")).toBe(true);
  });

  it("disallows draft → matched (must go through submitted+matching)", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "draft", "matched")).toBe(false);
  });

  it("allows submitted → matching", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "submitted", "matching")).toBe(true);
  });

  it("allows matching → matched", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "matching", "matched")).toBe(true);
  });

  it("allows matching → expired", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "matching", "expired")).toBe(true);
  });

  it("allows matched → booked", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "matched", "booked")).toBe(true);
  });

  it("disallows expired → any transition", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "expired", "draft")).toBe(false);
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "expired", "submitted")).toBe(false);
  });

  it("disallows cancelled → any transition", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "cancelled", "draft")).toBe(false);
  });

  it("disallows booked → matched (no backward transition)", () => {
    expect(isValidTransition(SERVICE_REQUEST_TRANSITIONS, "booked", "matched")).toBe(false);
  });
});

// =============================================================================
// Status Transitions — Booking
// =============================================================================

describe("Booking status transitions", () => {
  it("allows pending → confirmed", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "pending", "confirmed")).toBe(true);
  });

  it("allows confirmed → in_progress", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "confirmed", "in_progress")).toBe(true);
  });

  it("allows in_progress → completed", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "in_progress", "completed")).toBe(true);
  });

  it("allows in_progress → disputed", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "in_progress", "disputed")).toBe(true);
  });

  it("allows disputed → completed (resolution)", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "disputed", "completed")).toBe(true);
  });

  it("disallows completed → any transition (terminal)", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "completed", "pending")).toBe(false);
    expect(isValidTransition(BOOKING_TRANSITIONS, "completed", "in_progress")).toBe(false);
  });

  it("disallows cancelled → any transition (terminal)", () => {
    expect(isValidTransition(BOOKING_TRANSITIONS, "cancelled", "pending")).toBe(false);
  });
});

// =============================================================================
// Status Transitions — Job
// =============================================================================

describe("Job status transitions", () => {
  it("allows scheduled → in_progress", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "scheduled", "in_progress")).toBe(true);
  });

  it("allows in_progress → completed", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "in_progress", "completed")).toBe(true);
  });

  it("allows completed → paid", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "completed", "paid")).toBe(true);
  });

  it("disallows paid → any transition (terminal)", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "paid", "scheduled")).toBe(false);
  });

  it("disallows skipping steps (scheduled → completed)", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "scheduled", "completed")).toBe(false);
  });

  it("disallows skipping steps (scheduled → paid)", () => {
    expect(isValidTransition(JOB_TRANSITIONS, "scheduled", "paid")).toBe(false);
  });
});

// =============================================================================
// Status Transitions — Payment
// =============================================================================

describe("Payment status transitions", () => {
  it("allows pending → authorized", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "pending", "authorized")).toBe(true);
  });

  it("allows authorized → captured", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "authorized", "captured")).toBe(true);
  });

  it("allows authorized → refunded", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "authorized", "refunded")).toBe(true);
  });

  it("allows captured → released_to_pro", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "captured", "released_to_pro")).toBe(true);
  });

  it("allows captured → refunded", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "captured", "refunded")).toBe(true);
  });

  it("disallows released_to_pro → any transition (terminal)", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "released_to_pro", "refunded")).toBe(false);
  });

  it("disallows refunded → any transition (terminal)", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "refunded", "pending")).toBe(false);
  });

  it("disallows skipping authorization (pending → captured)", () => {
    expect(isValidTransition(PAYMENT_TRANSITIONS, "pending", "captured")).toBe(false);
  });
});
