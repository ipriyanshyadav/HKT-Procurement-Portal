import openapiTS from "openapi-typescript";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const OUTPUT_PATH = join(dirname(new URL(import.meta.url).pathname), "src", "api.ts");

async function generateTypes(): Promise<void> {
  try {
    const output = await openapiTS(new URL(`${API_URL}/api/v1/openapi.json`));
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, "utf-8");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Type generation failed: ${message}\nEnsure backend is running at ${API_URL}\n`);
    process.exit(1);
  }
}

generateTypes();
