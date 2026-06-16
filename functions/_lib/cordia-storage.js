const DEFAULT_STORAGE_BINDING = "STORAGE";
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.,=+@-]{0,511}$/;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {}),
    },
  });
}

export function methodNotAllowed(allow = "GET") {
  return jsonResponse(
    { error: "Method not allowed." },
    { status: 405, headers: { allow } },
  );
}

export function storageBucket(context, bindingName = DEFAULT_STORAGE_BINDING) {
  const bucket = context?.env?.[bindingName];

  if (!bucket || typeof bucket.get !== "function" || typeof bucket.put !== "function") {
    throw new Error(`Storage binding ${bindingName} is not configured.`);
  }

  return bucket;
}

export function assertStorageKey(key) {
  const clean = String(key || "").trim();

  if (!STORAGE_KEY_PATTERN.test(clean) || clean.includes("//") || clean.includes("..")) {
    throw new Error("Storage key is invalid.");
  }

  return clean;
}

export function storageKey(...parts) {
  return assertStorageKey(
    parts
      .map((part) => String(part || "").trim().replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/"),
  );
}

export async function readJsonObject(context, key, fallback = null, options = {}) {
  const bucket = storageBucket(context, options.bindingName);
  const object = await bucket.get(assertStorageKey(key));

  if (!object) {
    return fallback;
  }

  return object.json();
}

export async function writeJsonObject(context, key, value, options = {}) {
  const bucket = storageBucket(context, options.bindingName);
  const body = `${JSON.stringify(value, null, 2)}\n`;

  await bucket.put(assertStorageKey(key), body, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    customMetadata: {
      updatedAt: new Date().toISOString(),
    },
  });

  return value;
}

export async function deleteObject(context, key, options = {}) {
  const bucket = storageBucket(context, options.bindingName);
  await bucket.delete(assertStorageKey(key));
}

export function storageUnavailableResponse(error) {
  return jsonResponse(
    { error: "Storage is not configured.", detail: String(error?.message || "") },
    { status: 503 },
  );
}
