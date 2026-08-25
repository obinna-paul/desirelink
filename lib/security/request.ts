import "server-only";

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined;

export function getHeaderValue(headers: HeaderBag, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);

  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  if (!entry) return null;

  const value = entry[1];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function getClientIpFromHeaders(headers: HeaderBag): string {
  const forwardedFor = getHeaderValue(headers, "x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return getHeaderValue(headers, "x-real-ip") ?? "unknown";
}

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
