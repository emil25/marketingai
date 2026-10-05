import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getOptionalAuthContext, requireAuthContext } from "@/lib/server/auth-context.server";
import { newId, nowIso, publicUser, transact } from "@/lib/server/store.server";
import { useAppSession } from "@/lib/server/session.server";
import { normalizeBusinessType } from "@/lib/business-types";

const CredentialsSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(200),
});

const RegisterSchema = CredentialsSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  workspaceName: z.string().trim().min(2).max(160),
  businessType: z.string().optional().default("other"),
  brandDetails: z.object({
    name: z.string().trim().min(2).max(160),
    website: z.string().trim().max(500),
    logoUrl: z.string().trim().max(1000),
    openingHours: z.string().trim().max(1000),
    services: z.string().trim().max(4000),
    products: z.string().trim().max(4000),
    tone: z.string().trim().min(1).max(120),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).optional(),
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return getOptionalAuthContext();
});

export const requireCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return requireAuthContext();
});

export const requireAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  if (context.membership.role !== "owner" && context.membership.role !== "admin") {
    throw redirect({ to: "/app" });
  }
  return context;
});

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RegisterSchema.parse(data))
  .handler(async ({ data }) => {
    const { hashPassword } = await import("@/lib/server/password.server");
    const email = data.email.toLowerCase();
    const created = await transact((database) => {
      if (database.users.some((user) => user.email === email)) {
        throw new Error("Ezzel az email címmel már létezik felhasználó.");
      }
      const timestamp = nowIso();
      const user = {
        id: newId("user"),
        email,
        displayName: data.displayName,
        passwordHash: hashPassword(data.password),
        createdAt: timestamp,
      };
      const workspace = {
        id: newId("workspace"),
        name: data.workspaceName,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const membership = {
        id: newId("membership"),
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner" as const,
        createdAt: timestamp,
      };
      const brand = {
        id: newId("brand"),
        workspaceId: workspace.id,
        name: data.brandDetails?.name ?? data.workspaceName,
        website: data.brandDetails?.website ?? "",
        cityRegion: "",
        languageMarket: "magyar",
        industry: "",
        products: data.brandDetails?.products ?? "",
        services: data.brandDetails?.services ?? "",
        offers: "",
        audience: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const brandProfile = {
        id: newId("voice"),
        brandId: brand.id,
        tone: data.brandDetails?.tone ?? "Barátságos",
        businessType: normalizeBusinessType(data.businessType),
        ctaStyle: "Barátságos és közvetlen",
        values: "",
        preferredPhrases: "",
        avoidedPhrases: "",
        description: data.brandDetails?.openingHours ? `Nyitvatartás: ${data.brandDetails.openingHours}` : "",
        approvedExamples: "",
        aiGuardrails: "Ne találj ki árakat, akciókat, nyitvatartást vagy ügyfélvéleményeket.",
        logoUrl: data.brandDetails?.logoUrl ?? "",
        colors: data.brandDetails ? [data.brandDetails.color] : [],
        fontFamily: "Plus Jakarta Sans",
        learningSamples: [],
        learnedSummary: "",
        learnedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.users.push(user);
      database.workspaces.push(workspace);
      database.memberships.push(membership);
      database.brands.push(brand);
      database.brandProfiles.push(brandProfile);
      return { user, workspace, membership, brand };
    });

    const session = await useAppSession();
    await session.update({
      userId: created.user.id,
      workspaceId: created.workspace.id,
      activeBrandId: created.brand.id,
      themePreference: "marketingpilot-v2",
    });
    return { user: publicUser(created.user), workspace: created.workspace };
  });

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CredentialsSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyPassword } = await import("@/lib/server/password.server");
    const email = data.email.toLowerCase();
    const database = await import("@/lib/server/store.server").then((module) => module.readData());
    const user = database.users.find((candidate) => candidate.email === email);
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      throw new Error("Hibás email vagy jelszó.");
    }
    const membership = database.memberships.find((candidate) => candidate.userId === user.id);
    if (!membership) throw new Error("A felhasználóhoz nem tartozik munkatér.");
    const session = await useAppSession();
    await session.update({
      userId: user.id,
      workspaceId: membership.workspaceId,
      activeBrandId: undefined,
      themePreference: "marketingpilot-v2",
    });
    return { user: publicUser(user) };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  return { ok: true };
});
