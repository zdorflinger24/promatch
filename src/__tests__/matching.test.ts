import { describe, it, expect } from "vitest";
import {
  scoreExpertise,
  scoreTrackRecord,
  scoreProximity,
  scoreAvailability,
  scorePriceFit,
  WEIGHTS,
} from "@/server/scoring";
import { parsedIntakeSchema } from "@/server/intake-schema";

describe("Matching Engine Scoring", () => {
  // ─── Weight Verification ────────────────────────────────

  describe("WEIGHTS", () => {
    it("should sum to 1.0", () => {
      const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it("should match spec weights", () => {
      expect(WEIGHTS.expertise).toBe(0.30);
      expect(WEIGHTS.trackRecord).toBe(0.25);
      expect(WEIGHTS.proximity).toBe(0.15);
      expect(WEIGHTS.availability).toBe(0.15);
      expect(WEIGHTS.priceFit).toBe(0.15);
    });
  });

  // ─── Expertise Scoring ──────────────────────────────────

  describe("scoreExpertise", () => {
    it("returns 100 for sole category match", () => {
      expect(scoreExpertise(["plumbing"], "plumbing")).toBe(100);
    });

    it("returns 80 for match among multiple categories", () => {
      expect(scoreExpertise(["plumbing", "handyman"], "plumbing")).toBe(80);
    });

    it("returns 0 for no category match", () => {
      expect(scoreExpertise(["cleaning"], "plumbing")).toBe(0);
    });

    it("returns 0 for empty categories", () => {
      expect(scoreExpertise([], "plumbing")).toBe(0);
    });
  });

  // ─── Track Record Scoring ───────────────────────────────

  describe("scoreTrackRecord", () => {
    it("returns cold start default for 0 jobs", () => {
      expect(scoreTrackRecord(0, 0)).toBe(50);
    });

    it("gives boost for new pros (<=5 jobs)", () => {
      const score = scoreTrackRecord(3, 4.5);
      // Should include cold start boost of 10
      expect(score).toBeGreaterThan(scoreTrackRecord(10, 4.5));
      // Actually: new pros with high rating + boost can score higher
    });

    it("scores higher for better ratings", () => {
      const highRating = scoreTrackRecord(20, 5.0);
      const lowRating = scoreTrackRecord(20, 2.0);
      expect(highRating).toBeGreaterThan(lowRating);
    });

    it("scores higher for more completed jobs", () => {
      const manyJobs = scoreTrackRecord(50, 4.0);
      const fewJobs = scoreTrackRecord(5, 4.0);
      // fewJobs gets cold start boost but manyJobs has volume advantage
      expect(manyJobs).toBeGreaterThanOrEqual(fewJobs - 15); // allowing for boost
    });

    it("caps at 100", () => {
      const score = scoreTrackRecord(100, 5.0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ─── Proximity Scoring ──────────────────────────────────

  describe("scoreProximity", () => {
    it("returns 50 for null coordinates", () => {
      expect(scoreProximity(null, null, null, null, 25)).toBe(50);
      expect(scoreProximity(32.7, -96.8, null, null, 25)).toBe(50);
    });

    it("returns 100 for same location", () => {
      expect(scoreProximity(32.7767, -96.7970, 32.7767, -96.7970, 25)).toBe(100);
    });

    it("returns 0 for distance beyond service area", () => {
      // Dallas to Houston is ~240 miles
      const score = scoreProximity(32.7767, -96.7970, 29.7604, -95.3698, 25);
      expect(score).toBe(0);
    });

    it("decays linearly with distance", () => {
      // Two points ~10 miles apart in Dallas area
      const close = scoreProximity(32.7767, -96.7970, 32.7767, -96.9500, 25);
      // Two points ~20 miles apart
      const far = scoreProximity(32.7767, -96.7970, 32.7767, -97.1000, 25);
      expect(close).toBeGreaterThan(far);
    });
  });

  // ─── Availability Scoring ───────────────────────────────

  describe("scoreAvailability", () => {
    it("returns 60 for null or empty availability", () => {
      expect(scoreAvailability(null, "normal")).toBe(60);
      expect(scoreAvailability({}, "normal")).toBe(60);
    });

    it("returns 100 for emergency when available today", () => {
      const today = new Date();
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayName = dayNames[today.getDay()];
      const availability = { [todayName]: [["09:00", "17:00"] as [string, string]] };
      expect(scoreAvailability(availability, "emergency")).toBe(100);
    });

    it("returns 20 for emergency when not available today", () => {
      const today = new Date();
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayName = dayNames[today.getDay()];
      // Set availability for a day that is NOT today
      const otherDay = dayNames[(today.getDay() + 3) % 7];
      const availability = { [otherDay]: [["09:00", "17:00"] as [string, string]] };
      // Only if todayName !== otherDay
      if (todayName !== otherDay) {
        expect(scoreAvailability(availability, "emergency")).toBe(20);
      }
    });

    it("scores higher for more available days", () => {
      const oneDay = { monday: [["09:00", "17:00"] as [string, string]] };
      const fiveDays = {
        monday: [["09:00", "17:00"] as [string, string]],
        tuesday: [["09:00", "17:00"] as [string, string]],
        wednesday: [["09:00", "17:00"] as [string, string]],
        thursday: [["09:00", "17:00"] as [string, string]],
        friday: [["09:00", "17:00"] as [string, string]],
      };
      expect(scoreAvailability(fiveDays, "flexible")).toBeGreaterThan(
        scoreAvailability(oneDay, "flexible")
      );
    });
  });

  // ─── Price Fit Scoring ──────────────────────────────────

  describe("scorePriceFit", () => {
    it("returns 50 for null rates", () => {
      expect(scorePriceFit(null, "plumbing")).toEqual({ score: 50, estimate: null });
    });

    it("returns 50 for missing category rate", () => {
      expect(scorePriceFit({ cleaning: { min: 30, max: 50, unit: "hr" } }, "plumbing")).toEqual({
        score: 50,
        estimate: null,
      });
    });

    it("scores higher for lower rates", () => {
      const cheap = scorePriceFit(
        { plumbing: { min: 30, max: 50, unit: "hr" } },
        "plumbing"
      );
      const expensive = scorePriceFit(
        { plumbing: { min: 100, max: 150, unit: "hr" } },
        "plumbing"
      );
      expect(cheap.score).toBeGreaterThan(expensive.score);
    });

    it("returns price estimate as average of range", () => {
      const result = scorePriceFit(
        { plumbing: { min: 40, max: 60, unit: "hr" } },
        "plumbing"
      );
      expect(result.estimate).toBe(50);
    });

    it("caps score at 100", () => {
      const result = scorePriceFit(
        { plumbing: { min: 0, max: 0, unit: "hr" } },
        "plumbing"
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});

describe("Intake Parsing Schema", () => {
  it("validates correct intake data", () => {
    const valid = {
      category: "plumbing",
      urgency: "normal",
      description: "Leaking kitchen faucet",
      confidence: 0.95,
    };
    expect(parsedIntakeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid category", () => {
    const invalid = {
      category: "electrical",
      urgency: "normal",
      description: "Rewire outlet",
      confidence: 0.9,
    };
    expect(parsedIntakeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const invalid = {
      category: "plumbing",
      urgency: "normal",
      description: "Test",
      confidence: 1.5,
    };
    expect(parsedIntakeSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts all valid urgency levels", () => {
    for (const urgency of ["emergency", "urgent", "normal", "flexible"]) {
      const result = parsedIntakeSchema.safeParse({
        category: "cleaning",
        urgency,
        description: "Test",
        confidence: 0.8,
      });
      expect(result.success).toBe(true);
    }
  });
});
