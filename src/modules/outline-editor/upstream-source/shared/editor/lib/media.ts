const VIDEO_EXTENSION_PATTERN =
  /\.(mp4|m4v|mov|webm|ogv|ogg)(?:$|[?#])/i;
const PDF_EXTENSION_PATTERN = /\.pdf(?:$|[?#])/i;
const YOUTUBE_URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed|shorts)?(?:.*v=|v\/|\/)([a-zA-Z0-9_-]{11})([\&\?](.*))?$/i;

function normalizeUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function inferContentTypeFromName(name: string | null | undefined) {
  const normalized = normalizeUrl(name).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (normalized.endsWith(".m4v")) {
    return "video/x-m4v";
  }

  if (normalized.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (normalized.endsWith(".webm")) {
    return "video/webm";
  }

  if (normalized.endsWith(".ogv") || normalized.endsWith(".ogg")) {
    return "video/ogg";
  }

  return null;
}

export function getDataUrlContentType(value: string | null | undefined) {
  const match = normalizeUrl(value).match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function inferContentType(
  value: string | null | undefined,
  title?: string | null
) {
  const normalized = normalizeUrl(value);

  return (
    getDataUrlContentType(normalized) ??
    inferContentTypeFromName(normalized) ??
    inferContentTypeFromName(title)
  );
}

export function isPdfSource(value: string | null | undefined, title?: string | null) {
  return inferContentType(value, title) === "application/pdf";
}

export function isDirectVideoUrl(value: string | null | undefined) {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    return false;
  }

  return (
    (getDataUrlContentType(normalized)?.startsWith("video/") ?? false) ||
    normalized.startsWith("blob:") ||
    VIDEO_EXTENSION_PATTERN.test(normalized)
  );
}

export function isYouTubeUrl(value: string | null | undefined) {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    return false;
  }

  return YOUTUBE_URL_PATTERN.test(normalized);
}

export function isPersistedAssetUrl(value: string | null | undefined) {
  const normalized = normalizeUrl(value);

  return normalized.startsWith("data:") || normalized.startsWith("blob:");
}

export function getDisplayNameFromUrl(
  value: string | null | undefined,
  fallback = "Untitled"
) {
  const normalized = normalizeUrl(value);

  if (!normalized || normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return fallback;
  }

  try {
    const parsed = new URL(normalized);
    const segment = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");

    return segment || fallback;
  } catch (_error) {
    const segment = decodeURIComponent(
      normalized.split(/[?#]/, 1)[0]?.split("/").pop() ?? ""
    );

    return segment || fallback;
  }
}

export async function probeVideoSource(
  value: string
): Promise<{ height: number | null; poster: string | null; width: number | null }> {
  if (typeof document === "undefined") {
    return {
      height: null,
      poster: null,
      width: null,
    };
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish({
        height: video.videoHeight || null,
        poster: null,
        width: video.videoWidth || null,
      });
    }, 5000);

    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      window.clearTimeout(timeout);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const finish = (result: {
      height: number | null;
      poster: string | null;
      width: number | null;
    }) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const handleLoadedMetadata = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        handleLoadedData();
      }
    };

    const handleLoadedData = () => {
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;

      if (!width || !height) {
        finish({
          height,
          poster: null,
          width,
        });
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          finish({
            height,
            poster: null,
            width,
          });
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);

        finish({
          height,
          poster: canvas.toDataURL("image/png"),
          width,
        });
      } catch (_error) {
        finish({
          height,
          poster: null,
          width,
        });
      }
    };

    const handleError = () => {
      finish({
        height: null,
        poster: null,
        width: null,
      });
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    video.src = value;
    video.load();
  });
}

export function isVideoDimensionToken(value: string | undefined) {
  return Boolean(value && /^\d+x\d+$/i.test(value));
}

export function isPdfUrl(value: string | null | undefined) {
  const normalized = normalizeUrl(value);
  return PDF_EXTENSION_PATTERN.test(normalized);
}
