import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc";
import { pros, users } from "@/server/db/schema";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { createProSchema, updateProSchema } from "@/lib/validations";

export const proRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        verified: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const { limit = 20, offset = 0 } = input ?? {};
      const results = await db.query.pros.findMany({
        limit,
        offset,
        orderBy: (pros, { desc }) => [desc(pros.createdAt)],
        with: { user: true },
      });
      return results;
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const pro = await db.query.pros.findFirst({
        where: eq(pros.id, input.id),
        with: { user: true, reviews: true },
      });
      if (!pro) throw new Error("Pro not found");
      return pro;
    }),

  create: adminProcedure.input(createProSchema).mutation(async ({ input }) => {
    // Create user first, then pro profile
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        role: "pro",
      })
      .returning();

    const [pro] = await db
      .insert(pros)
      .values({
        userId: user.id,
        name: input.name,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        serviceAreaMiles: input.serviceAreaMiles,
        categories: input.categories as string[],
        rateRanges: (input.rateRanges ?? {}) as Record<string, { min: number; max: number; unit: string }>,
        availability: (input.availability ?? {}) as Record<string, [string, string][]>,
        bio: input.bio,
        metroId: "dfw",
      })
      .returning();

    return pro;
  }),

  update: adminProcedure.input(updateProSchema).mutation(async ({ input }) => {
    const { id, rateRanges, availability, categories, ...rest } = input;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (rateRanges !== undefined) updateData.rateRanges = rateRanges;
    if (availability !== undefined) updateData.availability = availability;
    if (categories !== undefined) updateData.categories = categories;
    const [updated] = await db
      .update(pros)
      .set(updateData)
      .where(eq(pros.id, id))
      .returning();
    if (!updated) throw new Error("Pro not found");
    return updated;
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const pro = await db.query.pros.findFirst({
        where: eq(pros.id, input.id),
      });
      if (!pro) throw new Error("Pro not found");
      // Delete user (cascades to pro via FK)
      await db.delete(users).where(eq(users.id, pro.userId));
      return { success: true };
    }),
});
