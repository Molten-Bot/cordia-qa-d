import {
  jsonResponse,
  methodNotAllowed,
  readJsonObject,
  storageKey,
  storageUnavailableResponse,
  writeJsonObject,
} from "../_lib/cordia-storage.js";

const SCORE_LIMIT = 10;
const SCORE_KEY = storageKey("dat-dolphin", "scores.json");

function sanitizeName(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return (clean || "Dolphin").slice(0, 18).trim();
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(9999, Math.floor(score)));
}

function createScoreId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeScores(value) {
  const scores = Array.isArray(value?.scores) ? value.scores : [];
  return scores
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: String(entry.id || createScoreId()),
      name: sanitizeName(entry.name),
      score: normalizeScore(entry.score),
      createdAt: String(entry.createdAt || new Date(0).toISOString()),
    }))
    .sort((left, right) => right.score - left.score || left.createdAt.localeCompare(right.createdAt))
    .slice(0, SCORE_LIMIT);
}

async function readScores(context) {
  const stored = await readJsonObject(context, SCORE_KEY, { scores: [] });
  return normalizeScores(stored);
}

async function writeScore(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
  }

  const entry = {
    id: createScoreId(),
    name: sanitizeName(body.name),
    score: normalizeScore(body.score),
    createdAt: new Date().toISOString(),
  };

  const scores = normalizeScores({ scores: [entry, ...(await readScores(context))] });
  await writeJsonObject(context, SCORE_KEY, { scores });
  return jsonResponse({ scores }, { status: 201 });
}

export async function onRequest(context) {
  try {
    if (context.request.method === "GET") {
      return jsonResponse({ scores: await readScores(context) });
    }

    if (context.request.method === "POST") {
      return writeScore(context);
    }

    return methodNotAllowed("GET, POST");
  } catch (error) {
    return storageUnavailableResponse(error);
  }
}
