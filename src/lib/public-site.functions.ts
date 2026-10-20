import { createServerFn } from "@tanstack/react-start";
import { brandForLocale, publicAppUrl } from "@/config/brand";

// Explicitly public business contact details only. Never return the environment.
export const getPublicOperator = createServerFn({ method: "GET" }).handler(async () => {
  const contact = brandForLocale().contact;
  const email =
    process.env[contact.emailEnv]?.trim() || process.env[contact.emailFallbackEnv]?.trim() || "";
  return {
    origin: publicAppUrl(),
    name:
      process.env[contact.nameEnv]?.trim() || process.env[contact.nameFallbackEnv]?.trim() || "",
    address:
      process.env[contact.addressEnv]?.trim() ||
      process.env[contact.addressFallbackEnv]?.trim() ||
      "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    about: process.env[contact.aboutEnv]?.trim() || "",
  };
});
