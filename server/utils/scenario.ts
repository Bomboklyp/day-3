import { createError, getQuery, setHeader, type H3Event } from "h3";
export async function applyApiScenario(event: H3Event): Promise<void> {
  const scenario = getQuery(event).scenario;
  if (scenario === "409")
    throw createError({
      statusCode: 409,
      statusMessage: "Request changed by another user",
    });
  if (scenario === "429") {
    setHeader(event, "Retry-After", 1);
    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      data: { retryAfter: 1 },
    });
  }
  if (scenario === "error" || scenario === "500")
    throw createError({
      statusCode: 500,
      statusMessage: "Service temporarily unavailable",
    });
  if (scenario === "loading")
    await new Promise<void>((resolve) => setTimeout(resolve, 1800));
}
