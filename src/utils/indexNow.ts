export type MovieLifecycleState = "Announced" | "Streaming Now" | "Archived";

export type IndexNowDispatchPayload = {
  url: string;
  key?: string;
  keyLocation?: string;
  lastModified?: string;
};

export type IndexNowDispatchResult = {
  ok: boolean;
  status: number;
  body: string;
};

const INDEXNOW_HOST = "api.indexnow.org";
const INDEXNOW_PATH = "/IndexNow";

function buildIndexNowPayload(url: string, key?: string, keyLocation?: string): Record<string, string> {
  const payload: Record<string, string> = {
    url
  };

  if (key) payload.key = key;
  if (keyLocation) payload.keyLocation = keyLocation;

  return payload;
}

export async function dispatchIndexNow(
  payload: IndexNowDispatchPayload,
  options?: { timeoutMs?: number; apiKey?: string }
): Promise<IndexNowDispatchResult> {
  const key = payload.key ?? options?.apiKey ?? process.env.INDEXNOW_KEY ?? "";
  const keyLocation = payload.keyLocation ?? process.env.INDEXNOW_KEY_LOCATION ?? "";

  const body = buildIndexNowPayload(payload.url, key || undefined, keyLocation || undefined);

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 8000;

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${INDEXNOW_HOST}${INDEXNOW_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FlixStream-IndexNow/1.0"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      body: text
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IndexNow dispatch error";

    return {
      ok: false,
      status: 0,
      body: message
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyMovieLifecycleChange(
  movieUrl: string,
  lifecycleState: MovieLifecycleState,
  options?: { timeoutMs?: number; apiKey?: string }
): Promise<IndexNowDispatchResult> {
  if (!movieUrl) {
    return {
      ok: false,
      status: 400,
      body: "movieUrl is required"
    };
  }

  if (lifecycleState === "Archived") {
    return {
      ok: true,
      status: 202,
      body: "Lifecycle state archived; no immediate IndexNow ping required"
    };
  }

  const payload: IndexNowDispatchPayload = {
    url: movieUrl,
    lastModified: new Date().toISOString()
  };

  return dispatchIndexNow(payload, options);
}
