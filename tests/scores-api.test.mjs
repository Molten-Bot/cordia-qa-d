import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/scores.js";

function createBucket(initialValue = null) {
  const store = new Map();
  if (initialValue) {
    store.set("dat-dolphin/scores.json", JSON.stringify(initialValue));
  }

  return {
    async get(key) {
      const value = store.get(key);
      return value
        ? {
            async json() {
              return JSON.parse(value);
            },
          }
        : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    store,
  };
}

function createContext(method, bucket, body) {
  return {
    env: { STORAGE: bucket },
    request: new Request("https://example.test/api/scores", {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "content-type": "application/json" } : undefined,
    }),
  };
}

test("scores API returns stored scores sorted by score", async () => {
  const bucket = createBucket({
    scores: [
      { id: "one", name: "One", score: 1, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "two", name: "Two", score: 5, createdAt: "2026-01-02T00:00:00.000Z" },
    ],
  });

  const response = await onRequest(createContext("GET", bucket));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.scores.map((entry) => entry.id),
    ["two", "one"],
  );
});

test("scores API stores sanitized submitted score", async () => {
  const bucket = createBucket();
  const response = await onRequest(createContext("POST", bucket, {
    name: "  Dat   Player  ",
    score: 12.9,
  }));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.scores[0].name, "Dat Player");
  assert.equal(body.scores[0].score, 12);
  assert.match(bucket.store.get("dat-dolphin/scores.json"), /Dat Player/);
});

test("scores API rejects invalid JSON", async () => {
  const bucket = createBucket();
  const context = {
    env: { STORAGE: bucket },
    request: new Request("https://example.test/api/scores", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    }),
  };

  const response = await onRequest(context);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid JSON body.");
});
