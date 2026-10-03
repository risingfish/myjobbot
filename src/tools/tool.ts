import { z } from "zod";

interface ToolSpec<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(args: z.infer<S>): unknown;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  invoke(raw: unknown): Promise<unknown>;
}

export function defineTool<S extends z.ZodType>(spec: ToolSpec<S>): Tool {
  const { $schema: _schema, ...parameters } = z.toJSONSchema(spec.schema, { io: "input" });
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    invoke: async (raw) => spec.run(spec.schema.parse(raw)),
  };
}
