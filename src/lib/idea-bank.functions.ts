import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildBusinessContext } from "./business-types";
import { currentIdeaBank, type SavedIdeaBank } from "./idea-bank";
import { requireBrandContext } from "./server/auth-context.server";
import { generateIdeaBank } from "./server/post-quick-actions.server";
import { completeAiJob, createAiJob, nowIso, readData, startAiJob, transact } from "./server/store.server";

export const getIdeaBank = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireBrandContext();
  const brand = context.activeBrand;
  if (!brand) throw new Error("Még nincs aktív vállalkozásod.");
  const saved = brand.profile.ideaBank ?? null;
  const current = currentIdeaBank(
    saved,
    brand.profile.businessType ?? "other",
    brand.audience,
  );
  return { bank: current, needsRefresh: Boolean(saved && !current) };
});

export const refreshIdeaBank = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ force: z.boolean().default(false) }).strict().parse(data))
  .handler(async ({ data }) => {
    const context = await requireBrandContext();
    const brand = context.activeBrand;
    if (!brand) throw new Error("Még nincs aktív vállalkozásod.");
    const businessType = brand.profile.businessType ?? "other";
    const cached = currentIdeaBank(brand.profile.ideaBank, businessType, brand.audience);
    if (cached && !data.force) return { bank: cached, cached: true };

    const job = await transact((database) =>
      createAiJob(database, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: {
          kind: "business_idea_bank",
          businessType,
          audienceLength: brand.audience.length,
        },
      }),
    );
    await transact((database) => startAiJob(database, job.id));
    try {
      const businessContext = buildBusinessContext(brand, brand.profile, {
        goal: "Témaötletek a közösségi posztokhoz",
        audience: brand.audience,
        language: brand.languageMarket,
        platform: "Facebook és Instagram",
      });
      const result = await generateIdeaBank(businessContext);
      const bank: SavedIdeaBank = {
        businessType,
        audience: brand.audience,
        ideas: result.ideas,
        generatedAt: nowIso(),
      };
      await transact((database) => {
        const profile = database.brandProfiles.find((item) => item.brandId === brand.id);
        if (!profile) throw new Error("A vállalkozás adatai nem találhatók.");
        profile.ideaBank = bank;
        profile.updatedAt = nowIso();
        completeAiJob(database, job.id);
      });
      const refreshed = (await readData()).brandProfiles.find((item) => item.brandId === brand.id)?.ideaBank;
      return { bank: refreshed ?? bank, cached: false };
    } catch (cause) {
      await transact((database) =>
        completeAiJob(database, job.id, cause instanceof Error ? cause.message : "Az ötletbank nem készült el."),
      );
      throw cause;
    }
  });
