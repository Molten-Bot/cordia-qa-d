import { jsonResponse, methodNotAllowed, storageBucket, storageUnavailableResponse } from "../../_lib/cordia-storage.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  try {
    storageBucket(context);
    return jsonResponse({ storage: "ready" });
  } catch (error) {
    return storageUnavailableResponse(error);
  }
}
