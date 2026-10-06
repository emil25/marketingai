import { createServerFn } from "@tanstack/react-start";

// Explicitly public business contact details only. Never return the environment.
export const getPublicOperator = createServerFn({ method: "GET" }).handler(async () => {
  const email = process.env["PUBLIC_CONTACT_EMAIL"]?.trim() || "";
  return {
    name: process.env["PUBLIC_OPERATOR_NAME"]?.trim() || "",
    address: process.env["PUBLIC_OPERATOR_ADDRESS"]?.trim() || "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    about: process.env["PUBLIC_OPERATOR_ABOUT"]?.trim() || "",
  };
});
