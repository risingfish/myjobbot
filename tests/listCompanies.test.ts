import { expect, test } from "vitest";
import { testContext } from "./helpers/context.js";
import { invokeTool } from "./helpers/tools.js";

test("list_companies returns each company's name and board type", async () => {
  const result = await invokeTool(testContext(), "list_companies", {});
  expect(result).toEqual([{ name: "Stripe", ats: "greenhouse" }]);
});
