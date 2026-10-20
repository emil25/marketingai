import { createHash, timingSafeEqual } from "node:crypto";
import { isProductionEnvironment } from "./production-config.server";

type Environment = Record<string, string | undefined>;
export function betaConfiguration(env: Environment = process.env) {
  const mode = env.BETA_MODE?.trim() || "off";
  return {
    privateBeta: mode === "private",
    validMode: mode === "off" || mode === "private",
    inviteReady: !!env.BETA_INVITE_CODE?.trim(),
  };
}

/** Compare fixed-length hashes; never return, store or log the shared invitation. */
export function requireBetaInvitation(code: string, env: Environment = process.env) {
  const beta = betaConfiguration(env);
  if (!beta.validMode) throw new Error("A regisztráció átmenetileg nem érhető el.");
  if (!beta.privateBeta) return false;
  if (!beta.inviteReady) throw new Error("Zárt béta: a regisztráció jelenleg nem elérhető.");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(code.trim()), digest(env.BETA_INVITE_CODE!.trim())))
    throw new Error("A meghívókód nem megfelelő. Ellenőrizd a kapott kódot.");
  return true;
}

export function betaAccountAccess(invitedAt?: string) {
  const beta = betaConfiguration();
  return (
    beta.privateBeta && beta.inviteReady && !!invitedAt && Number.isFinite(Date.parse(invitedAt))
  );
}

export function developmentEmailAllowed(env: Environment = process.env) {
  return !isProductionEnvironment(env) && !env.VERCEL;
}
