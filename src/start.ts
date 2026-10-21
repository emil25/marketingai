import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { isRedirect, isNotFound } from "@tanstack/react-router";
import { safeDatabaseErrorMetadata } from "./lib/server/safe-db-error.server";

const functionErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) throw error;
    const validation = error instanceof Error && error.name === "ZodError";
    const database =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      /^[0-9A-Z]{5}$/.test(String(error.code));
    console.error(
      JSON.stringify({
        event: "server_function_failed",
        code: validation ? "INVALID_INPUT" : database ? "STORAGE_ERROR" : "OPERATION_FAILED",
        ...(database ? { database: safeDatabaseErrorMetadata(error) } : {}),
      }),
    );
    if (validation) throw new Error("Ellenőrizd a megadott mezőket, majd próbáld újra.");
    if (database || !(error instanceof Error) || !/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(error.message))
      throw new Error("A művelet most nem sikerült. Próbáld újra néhány perc múlva.");
    throw error;
  }
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Do not log exception messages, input bodies, URLs or provider responses.
    console.error(JSON.stringify({ event: "request_failed", code: "UNEXPECTED_SERVER_ERROR" }));
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) =>
    ctx.handlerType === "serverFn" ||
    (new URL(ctx.request.url).pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(ctx.request.method)),
  failureResponse: () =>
    Response.json(
      {
        error:
          "A kérés biztonsági ellenőrzése nem sikerült. Frissítsd az oldalt, majd próbáld újra.",
      },
      { status: 403 },
    ),
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  functionMiddleware: [functionErrors],
}));

