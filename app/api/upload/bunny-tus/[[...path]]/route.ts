import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUNNY_TUS_ORIGIN = "https://video.bunnycdn.com";
const BUNNY_TUS_PATH = "/tusupload";
const MAX_CHUNK_BYTES = 3.25 * 1024 * 1024;

const REQUEST_HEADERS = [
  "authorizationexpire",
  "authorizationsignature",
  "content-type",
  "libraryid",
  "tus-resumable",
  "upload-concat",
  "upload-defer-length",
  "upload-length",
  "upload-metadata",
  "upload-offset",
  "videoid",
  "x-http-method-override",
] as const;

const RESPONSE_HEADERS = [
  "retry-after",
  "tus-extension",
  "tus-max-size",
  "tus-resumable",
  "tus-version",
  "upload-expires",
  "upload-length",
  "upload-offset",
] as const;

type RouteContext = { params: { path?: string[] } };

function upstreamUrl(req: Request, path: string[] | undefined) {
  const safePath = (path ?? [])
    .filter((part) => /^[a-zA-Z0-9._~-]+$/.test(part))
    .map(encodeURIComponent)
    .join("/");
  const query = new URL(req.url).search;
  return `${BUNNY_TUS_ORIGIN}${BUNNY_TUS_PATH}${safePath ? `/${safePath}` : ""}${query}`;
}

function forwardedRequestHeaders(req: Request) {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function forwardedResponseHeaders(upstream: Response, req: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  const location = upstream.headers.get("location");
  if (location) {
    const parsed = new URL(location, BUNNY_TUS_ORIGIN);
    if (parsed.origin === BUNNY_TUS_ORIGIN && parsed.pathname.startsWith(BUNNY_TUS_PATH)) {
      const suffix = parsed.pathname.slice(BUNNY_TUS_PATH.length);
      const origin = new URL(req.url).origin;
      headers.set("Location", `${origin}/api/upload/bunny-tus${suffix}${parsed.search}`);
    }
  }
  return headers;
}

async function relay(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const method = req.method.toUpperCase();
  if (!['POST', 'PATCH', 'HEAD'].includes(method)) {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CHUNK_BYTES) {
    return Response.json({ error: "Upload chunk is too large" }, { status: 413 });
  }

  try {
    const body = method === "PATCH" ? await req.arrayBuffer() : undefined;
    if (body && body.byteLength > MAX_CHUNK_BYTES) {
      return Response.json({ error: "Upload chunk is too large" }, { status: 413 });
    }

    const upstream = await fetch(upstreamUrl(req, context.params.path), {
      method,
      headers: forwardedRequestHeaders(req),
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 204) {
      const detail = (await upstream.clone().text().catch(() => "")).slice(0, 300);
      console.error("[upload/bunny-tus] upstream rejected request", {
        method,
        status: upstream.status,
        detail,
      });
    }

    const responseBody = method === "HEAD" ? null : await upstream.arrayBuffer();
    return new Response(responseBody && responseBody.byteLength > 0 ? responseBody : null, {
      status: upstream.status,
      headers: forwardedResponseHeaders(upstream, req),
    });
  } catch (error) {
    console.error("[upload/bunny-tus] relay failed", {
      method,
      path: context.params.path?.join("/") ?? "",
      error,
    });
    return Response.json(
      { error: "The video upload connection was interrupted. Udala will resume it automatically." },
      { status: 502 },
    );
  }
}

export function POST(req: Request, context: RouteContext) {
  return relay(req, context);
}

export function PATCH(req: Request, context: RouteContext) {
  return relay(req, context);
}

export function HEAD(req: Request, context: RouteContext) {
  return relay(req, context);
}
