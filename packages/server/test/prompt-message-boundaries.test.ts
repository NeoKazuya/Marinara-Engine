import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GENERATION_PARAMS } from "@marinara-engine/shared";
import type { DB } from "../src/db/connection.js";
import { assemblePrompt } from "../src/services/prompt/assembler.js";
import { mergeAdjacentMessages } from "../src/services/prompt/merger.js";

test("provider normalization keeps post-history prompt instructions separate from the last user turn", () => {
  const merged = mergeAdjacentMessages([
    { role: "system", content: "<role>Role instructions</role>", contextKind: "prompt" },
    { role: "user", content: "<chat_history>Earlier user turn", contextKind: "history" },
    { role: "assistant", content: "Earlier assistant turn</chat_history>", contextKind: "history" },
    { role: "user", content: "<last_message>Latest user turn</last_message>", contextKind: "history" },
    { role: "user", content: "<output_format>Write the response.</output_format>", contextKind: "prompt" },
  ]);

  assert.deepEqual(
    merged.map((message) => ({ role: message.role, contextKind: message.contextKind, content: message.content })),
    [
      { role: "system", contextKind: "prompt", content: "<role>Role instructions</role>" },
      { role: "user", contextKind: "history", content: "<chat_history>Earlier user turn" },
      { role: "assistant", contextKind: "history", content: "Earlier assistant turn</chat_history>" },
      { role: "user", contextKind: "history", content: "<last_message>Latest user turn</last_message>" },
      { role: "user", contextKind: "prompt", content: "<output_format>Write the response.</output_format>" },
    ],
  );
});

test("provider normalization still merges adjacent messages from the same context bucket", () => {
  const merged = mergeAdjacentMessages([
    { role: "system", content: "<role>Role instructions</role>", contextKind: "prompt" },
    { role: "system", content: "<lore>Setting details</lore>", contextKind: "prompt" },
    { role: "user", content: "Earlier user turn", contextKind: "history" },
    { role: "user", content: "Another user fragment", contextKind: "history" },
  ]);

  assert.deepEqual(
    merged.map((message) => ({ role: message.role, contextKind: message.contextKind, content: message.content })),
    [
      {
        role: "system",
        contextKind: "prompt",
        content: "<role>Role instructions</role>\n\n<lore>Setting details</lore>",
      },
      { role: "user", contextKind: "history", content: "Earlier user turn\n\nAnother user fragment" },
    ],
  );
});

test("provider normalization keeps image-only user messages", () => {
  const image = "data:image/png;base64,abc123";
  const merged = mergeAdjacentMessages([
    { role: "user", content: "   " },
    { role: "user", content: "", images: [image] },
  ]);

  assert.deepEqual(merged, [{ role: "user", content: "", images: [image] }]);
});

test("provider normalization merges image-only fragments without blank separators", () => {
  const image = "data:image/png;base64,abc123";
  const merged = mergeAdjacentMessages([
    { role: "user", content: "", images: [image] },
    { role: "user", content: "Describe this image." },
  ]);

  assert.deepEqual(
    merged.map((message) => ({ role: message.role, content: message.content, images: message.images })),
    [{ role: "user", content: "Describe this image.", images: [image] }],
  );
});

test("prompt assembly keeps image-only chat history messages", async () => {
  const image = "data:image/png;base64,abc123";
  const result = await assemblePrompt({
    db: {} as DB,
    preset: {
      id: "preset-1",
      name: "Preset",
      sectionOrder: JSON.stringify(["history-section"]),
      groupOrder: "[]",
      wrapFormat: "none",
      parameters: JSON.stringify(DEFAULT_GENERATION_PARAMS),
      variableGroups: "[]",
      variableValues: "{}",
    },
    sections: [
      {
        id: "history-section",
        presetId: "preset-1",
        identifier: "history",
        name: "History",
        content: "",
        role: "user",
        enabled: "true",
        isMarker: "true",
        groupId: null,
        markerConfig: JSON.stringify({ type: "chat_history" }),
        injectionPosition: "ordered",
        injectionDepth: 0,
        injectionOrder: 0,
        forbidOverrides: "false",
      },
    ],
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "chat-1",
    characterIds: [],
    personaName: "User",
    personaDescription: "",
    chatMessages: [
      { role: "user", content: "", images: [image] },
      { role: "user", content: "Describe this image." },
    ],
    activeLorebookIds: [],
  });

  assert.deepEqual(
    result.messages.map((message) => ({ role: message.role, content: message.content, images: message.images })),
    [{ role: "user", content: "Describe this image.", images: [image] }],
  );
});
