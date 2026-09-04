import openapiTS, { astToString } from "openapi-typescript";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const OUTPUT_PATH = join(dirname(new URL(import.meta.url).pathname), "src", "api.ts");
const LOCAL_SPEC = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "openapi.json");

async function generateTypes(): Promise<void> {
  try {
    const ast = await openapiTS(new URL(`${API_URL}/api/v1/openapi.json`)).catch(async (err) => {
      if (existsSync(LOCAL_SPEC)) {
        return await openapiTS(LOCAL_SPEC);
      }
      throw err;
    });
    const output = astToString(ast);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, "utf-8");
  } catch (error: unknown) {
    if (existsSync(LOCAL_SPEC)) {
      try {
        const ast = await openapiTS(LOCAL_SPEC);
        const output = astToString(ast);
        mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
        writeFileSync(OUTPUT_PATH, output, "utf-8");
        return;
      } catch (localErr) {
        // fallthrough
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Type generation failed: ${message}\nEnsure backend is running at ${API_URL}\n`);
    process.exit(1);
  }
}

generateTypes();
