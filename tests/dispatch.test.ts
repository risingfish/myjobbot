import { expect, test } from "vitest";
import { z } from "zod";
import { dispatch } from "../src/tools/dispatch.js";
import { defineTool } from "../src/tools/tool.js";

const echo = defineTool({
  name: "echo",
  description: "Echo text back",
  schema: z.object({ text: z.string() }),
  run: ({ text }) => ({ text }),
});

test("defineTool exposes the input JSON Schema without $schema", () => {
  expect(echo.parameters).toEqual({
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  });
});

test("dispatch returns the tool result as JSON", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: '{"text":"hi"}' });
  expect(outcome).toEqual({ ok: true, content: '{"text":"hi"}' });
});

test("dispatch reports invalid arguments", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: '{"text":5}' });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain("expected string");
});

test("dispatch reports malformed JSON", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: "{not json" });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain("error");
});

test("dispatch reports an unknown tool and lists the real ones", async () => {
  const outcome = await dispatch([echo], { name: "nope", arguments: "{}" });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain('unknown tool \\"nope\\"; available: echo');
});

test("dispatch treats empty arguments as an empty object", async () => {
  const ping = defineTool({ name: "ping", description: "Ping", schema: z.object({}), run: () => "pong" });
  expect(await dispatch([ping], { name: "ping", arguments: "" })).toEqual({ ok: true, content: '"pong"' });
});
