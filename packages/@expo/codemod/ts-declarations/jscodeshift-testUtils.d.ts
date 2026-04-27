declare module "jscodeshift/dist/testUtils" {
  import type { Parser, Transform } from "jscodeshift";

  export function applyTransform(
    module: Transform | { default: Transform },
    options: Record<string, unknown>,
    input: { source: string; path?: string },
    testOptions?: { parser?: "babel" | "babylon" | "flow" | "ts" | "tsx" | Parser }
  ): string;
}
