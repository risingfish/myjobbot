import { describeError } from "../errors.js";
import type { Tool } from "./tool.js";

interface ToolCallRequest {
  name: string;
  arguments: string;
}

interface ToolOutcome {
  ok: boolean;
  content: string;
}

const MAX_ERROR_CHARS = 2000;
const TRUNCATION_MARKER = "… (truncated)";

export async function dispatch(tools: Tool[], call: ToolCallRequest): Promise<ToolOutcome> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (!tool) return failure(`unknown tool "${call.name}"; available: ${tools.map((t) => t.name).join(", ")}`);
  try {
    const result = await tool.invoke(parseArguments(call.arguments));
    return { ok: true, content: JSON.stringify(result ?? null) };
  } catch (error) {
    return failure(describeError(error));
  }
}

function parseArguments(raw: string): unknown {
  return raw.trim() === "" ? {} : JSON.parse(raw);
}

function failure(message: string): ToolOutcome {
  return { ok: false, content: JSON.stringify({ error: truncate(message) }) };
}

function truncate(message: string): string {
  if (message.length <= MAX_ERROR_CHARS) return message;
  return message.slice(0, MAX_ERROR_CHARS - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}
