import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const CANNED_COMPLETION = {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 1791055037,
  model: "test-model",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call_0", type: "function", function: { name: "finish", arguments: '{"summary":"done"}' } }],
      },
    },
  ],
  usage: { prompt_tokens: 281, completion_tokens: 22, total_tokens: 303 },
  timings: { prompt_per_second: 521.7, predicted_per_second: 53.6 },
};

export interface FakeLlm {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startFakeLlm(): Promise<FakeLlm> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(CANNED_COMPLETION)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}/v1`, close: () => closeServer(server) };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
