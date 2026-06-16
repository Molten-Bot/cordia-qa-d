import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeLeaderboard,
  normalizeScore,
  sanitizePlayerName,
} from "../public/app.js";

test("sanitizePlayerName trims whitespace and supplies fallback", () => {
  assert.equal(sanitizePlayerName("  Ace   Fin  "), "Ace Fin");
  assert.equal(sanitizePlayerName(" "), "Dolphin");
  assert.equal(sanitizePlayerName("Long Dolphin Name Beyond Limit"), "Long Dolphin Name");
});

test("normalizeScore clamps to public score range", () => {
  assert.equal(normalizeScore(12.8), 12);
  assert.equal(normalizeScore(-4), 0);
  assert.equal(normalizeScore("10050"), 9999);
  assert.equal(normalizeScore("nope"), 0);
});

test("normalizeLeaderboard filters invalid entries and sorts high scores first", () => {
  const scores = normalizeLeaderboard([
    { id: "low", name: "Low", score: 2, createdAt: "2026-01-03T00:00:00.000Z" },
    { id: "bad", name: "Bad", score: "9", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "high", name: "High", score: 8, createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "tie", name: "Tie", score: 8, createdAt: "2026-01-01T00:00:00.000Z" },
  ]);

  assert.deepEqual(
    scores.map((entry) => entry.id),
    ["tie", "high", "low"],
  );
});

test("served files do not reference disallowed providers or tooling", async () => {
  const servedFiles = [
    "public/app.js",
    "public/humans.txt",
    "public/index.html",
    "public/llm.txt",
  ];

  for (const file of servedFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bgit\b|cloudflare/i, file);
  }
});
