/**
 * XHR upload with progress. `fetch` still cannot report request-body progress
 * in every browser, and an upload that shows nothing for five seconds reads
 * as broken — the admin clicks again and ends up with two copies.
 */
export interface UploadResponse<T> {
  status: number;
  /** Parsed JSON body, or null when the body wasn't JSON. */
  json: T | null;
}

export function xhrUpload<T = unknown>(opts: {
  url: string;
  method?: "POST" | "PUT";
  body: FormData | Blob;
  headers?: Record<string, string>;
  /** 0–100, called as bytes leave the browser. */
  onProgress?: (pct: number) => void;
}): Promise<UploadResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "POST", opts.url);
    for (const [k, v] of Object.entries(opts.headers ?? {})) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let json: T | null = null;
      try {
        json = xhr.responseText ? (JSON.parse(xhr.responseText) as T) : null;
      } catch {
        json = null;
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.onabort = () => reject(new Error("ABORTED"));
    xhr.send(opts.body);
  });
}

/** Human-readable failure for a non-2xx upload response. */
export function uploadErrorMessage(
  res: UploadResponse<{ error?: string; demo?: boolean }>,
  fallback: string,
): string {
  if (res.json?.demo) return "Demo горим: файл хадгалагдсангүй.";
  if (typeof res.json?.error === "string" && res.json.error)
    return res.json.error;
  if (res.status === 413) return "Файл серверийн хязгаараас том байна.";
  return `${fallback} (${res.status}).`;
}
