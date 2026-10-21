import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getOptionalAuthContext, requireAuthContext } from "@/lib/server/auth-context.server";
import { newId, nowIso, publicUser, transact } from "@/lib/server/store.server";
import { useAppSession } from "@/lib/server/session.server";
import { normalizeBusinessType } from "@/lib/business-types";
import {
  normalizeBusinessWebsite,
  validateBusinessTypeDetails,
  validateMainProducts,
} from "@/lib/onboarding-details";
import { brandVoiceGuardrails, defaultAddressing, BRAND_MOODS } from "@/lib/onboarding-brand";
import {
  authConfiguration,
  protectAuth,
  consumeAuthLimit,
  newAuthToken,
  sendAuthEmail,
} from "@/lib/server/auth-security.server";
import { requireBetaInvitation } from "@/lib/server/beta-access.server";
import { normalizeRomanianPhone } from "@/lib/market/ro";
import {
  ensurePreviewDemoAccountInPostgres,
  previewDemoLoginEnabled,
} from "@/lib/server/preview-demo.server";

const CredentialsSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(200),
  botToken: z.string().max(2048).optional().default(""),
});

const RegisterSchema = CredentialsSchema.extend({
  inviteCode: z.string().max(512).optional().default(""),
  displayName: z.string().trim().min(2).max(120),
  workspaceName: z.string().trim().min(2).max(160),
  businessType: z.string().optional().default("other"),
  brandDetails: z
    .object({
      name: z.string().trim().min(2).max(160),
      industry: z.string().trim().max(500).optional().default(""),
      website: z.string().trim().max(500).transform(normalizeBusinessWebsite),
      logoUrl: z.string().trim().max(1000),
      openingHours: z.string().trim().max(1000),
      address: z.string().trim().max(1000).optional().default(""),
      houseNumber: z.string().trim().max(80).optional().default(""),
      county: z.string().trim().max(120).optional().default(""),
      phone: z.string().trim().max(80).transform(normalizeRomanianPhone).optional().default(""),
      cityNameMode: z.enum(["hu", "ro", "both"]).optional().default("hu"),
      localPhrases: z.string().trim().max(1000).optional().default(""),
      localEvents: z.string().trim().max(4000).optional().default(""),
      approvedClaims: z.array(z.string().trim().min(2).max(200)).max(30).optional().default([]),
      cityRegion: z.string().trim().max(160).optional().default(""),
      offers: z.string().trim().max(4000).optional().default(""),
      contactMethod: z.string().trim().max(1000).optional().default(""),
      addressing: z.enum(["te", "Ön", "ti"]).optional(),
      mood: z.enum(BRAND_MOODS).or(z.literal("")).optional().default(""),
      audience: z.string().trim().max(2000).optional().default(""),
      services: z.string().trim().max(4000),
      products: z.string().trim().max(4000).transform(validateMainProducts),
      tone: z.string().trim().min(1).max(120),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .optional(),
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
    if (data.brandDetails)
      validateBusinessTypeDetails(
        data.businessType,
        data.brandDetails.industry,
        data.brandDetails.products,
      );
    const { hashPassword } = await import("@/lib/server/password.server");
    const email = data.email.toLowerCase();
    if (!authConfiguration().registrationEnabled)
      throw new Error(authConfiguration().registrationMessage);
    await protectAuth("signup", email, data.botToken, 4);
    const betaInvited = requireBetaInvitation(data.inviteCode);
    const verification = newAuthToken(24 * 60);
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
        uiMode: "simple" as const,
        uiModeSuggestionDismissed: false,
        auth: {
          emailVerifiedAt: null,
          sessionVersion: 0,
          ...(betaInvited ? { betaInvitedAt: timestamp } : { verification: verification.stored }),
        },
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
        cityRegion: data.brandDetails?.cityRegion ?? "",
        languageMarket: "magyar",
        industry: data.brandDetails?.industry ?? "",
        products: data.brandDetails?.products ?? "",
        services: data.brandDetails?.services ?? "",
        offers: data.brandDetails?.offers ?? "",
        audience: data.brandDetails?.audience ?? "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const brandProfile = {
        id: newId("voice"),
        brandId: brand.id,
        tone: data.brandDetails?.tone ?? "Barátságos",
        businessType: normalizeBusinessType(data.businessType),
        address: data.brandDetails?.address ?? "",
        houseNumber: data.brandDetails?.houseNumber ?? "",
        county: data.brandDetails?.county ?? "",
        phone: data.brandDetails?.phone ?? "",
        cityNameMode: data.brandDetails?.cityNameMode ?? "hu",
        localPhrases: data.brandDetails?.localPhrases ?? "",
        localEvents: data.brandDetails?.localEvents ?? "",
        approvedClaims: data.brandDetails?.approvedClaims ?? [],
        openingHours: data.brandDetails?.openingHours ?? "",
        ctaStyle: data.brandDetails?.contactMethod || "A célhoz illő, egyetlen konkrét felhívás",
        values: "",
        preferredPhrases: "",
        avoidedPhrases: "",
        description: "",
        approvedExamples: "",
        aiGuardrails: brandVoiceGuardrails(
          data.brandDetails?.addressing ?? defaultAddressing(data.businessType),
          data.brandDetails?.mood,
        ),
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
      sessionVersion: 0,
      themePreference: "marketingpilot-v2",
    });
    let emailSent = false;
    if (!betaInvited) {
      try {
        await sendAuthEmail(email, "verify", verification.token);
        emailSent = true;
      } catch {
        /* The registered user can resend without losing onboarding data. */
      }
    }
    return {
      user: publicUser(created.user),
      workspace: created.workspace,
      emailSent,
      nextUrl: betaInvited
        ? data.brandDetails
          ? "/app/posts/new?first=1"
          : "/onboarding"
        : "/verify-email",
    };
  });

/** A persistent fictional account avoids repeated signup attempts in the private Preview. */
export const startPreviewDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  if (!previewDemoLoginEnabled())
    throw new Error("A próba-belépés csak a kijelölt előnézetben érhető el.");
  const ip = getRequestHeader("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  await consumeAuthLimit("preview-demo:shared", 20, 60);
  if (ip) await consumeAuthLimit(`preview-demo:ip:${ip}`, 5, 60);

  const { hashPassword } = await import("@/lib/server/password.server");
  const account = await ensurePreviewDemoAccountInPostgres(async () => hashPassword(randomUUID()));
  const session = await useAppSession();
  await session.update({
    userId: account.user.id,
    workspaceId: account.workspace.id,
    activeBrandId: account.brand.id,
    sessionVersion: account.user.auth?.sessionVersion ?? 0,
    themePreference: "marketingpilot-v2",
  });
  return { nextUrl: "/app" };
});

/** Onboarding writes only the authenticated user's active brand, in one transaction. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = z
      .object({
        businessType: z.string().max(160),
        brandDetails: RegisterSchema.shape.brandDetails.unwrap(),
      })
      .parse(data);
    validateBusinessTypeDetails(
      parsed.businessType,
      parsed.brandDetails.industry,
      parsed.brandDetails.products,
    );
    return parsed;
  })
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const details = data.brandDetails;
    await transact((db) => {
      const brand = db.brands.find(
        (b) => b.id === context.activeBrand?.id && b.workspaceId === context.workspace.id,
      );
      const voice = db.brandProfiles.find((v) => v.brandId === brand?.id);
      if (!brand || !voice) throw new Error("A vállalkozás nem található. Frissítsd az oldalt.");
      const timestamp = nowIso();
      Object.assign(brand, {
        name: details.name,
        website: details.website,
        cityRegion: details.cityRegion,
        industry: details.industry,
        products: details.products,
        services: details.services,
        offers: details.offers,
        audience: details.audience,
        updatedAt: timestamp,
      });
      Object.assign(voice, {
        businessType: normalizeBusinessType(data.businessType),
        address: details.address,
        houseNumber: details.houseNumber,
        county: details.county,
        phone: details.phone,
        cityNameMode: details.cityNameMode,
        localPhrases: details.localPhrases,
        localEvents: details.localEvents,
        approvedClaims: details.approvedClaims,
        openingHours: details.openingHours,
        tone: details.tone,
        ctaStyle: details.contactMethod || "Írj nekünk!",
        aiGuardrails: brandVoiceGuardrails(
          details.addressing ?? defaultAddressing(data.businessType),
          details.mood,
        ),
        colors: [details.color],
        logoUrl: details.logoUrl,
        updatedAt: timestamp,
      });
    });
    return { ok: true };
  });

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CredentialsSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyPassword } = await import("@/lib/server/password.server");
    const email = data.email.toLowerCase();
    await protectAuth("login", email, data.botToken);
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
      sessionVersion: user.auth?.sessionVersion ?? 0,
      themePreference: "marketingpilot-v2",
    });
    if (user.auth?.deleting) throw redirect({ to: "/account-deletion" });
    return { user: publicUser(user) };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  return { ok: true };
});
