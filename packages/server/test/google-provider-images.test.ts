import test from "node:test";
import assert from "node:assert/strict";
import { GoogleProvider } from "../src/services/llm/providers/google.provider.js";
import type { ChatMessage, ChatOptions } from "../src/services/llm/base-provider.js";

async function captureRequestBody(messages: ChatMessage[], overrides: Partial<ChatOptions> = {}) {
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const provider = new GoogleProvider("https://generativelanguage.googleapis.com", "test-key");
    const options: ChatOptions = {
      model: "gemini-2.0-flash",
      stream: false,
      maxTokens: 512,
      ...overrides,
    };

    for await (const _ of provider.chat(messages, options)) {
      // Consume the non-streaming generator.
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  return requests[0]!;
}

test("Google chat keeps image-only user messages", async () => {
  const image = "data:image/png;base64,abc123";
  const body = await captureRequestBody([{ role: "user", content: "", images: [image] }]);

  const contents = body.contents as Array<{ role: string; parts: unknown[] }>;
  assert.deepEqual(contents, [
    {
      role: "user",
      parts: [{ inline_data: { mime_type: "image/png", data: "abc123" } }],
    },
  ]);
  assert.equal(JSON.stringify(body).includes("Continue."), false);
});
