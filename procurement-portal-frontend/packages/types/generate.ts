import openapiTS, { astToString } from "openapi-typescript";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const OUTPUT_PATH = join(dirname(new URL(import.meta.url).pathname), "src", "api.ts");
const LOCAL_SPEC = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "openapi.json");

async function generateTypes(): Promise<void> {
  try {
    let ast;
    try {
      ast = await openapiTS(new URL(`${API_URL}/api/v1/openapi.json`));
    } catch (netErr) {
      if (existsSync(LOCAL_SPEC)) {
        const spec = JSON.parse(readFileSync(LOCAL_SPEC, "utf-8"));
        ast = await openapiTS(spec);
      } else {
        throw netErr;
      }
    }
    const output = astToString(ast);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, "utf-8");
  } catch (error: unknown) {
    if (existsSync(LOCAL_SPEC)) {
      try {
        const spec = JSON.parse(readFileSync(LOCAL_SPEC, "utf-8"));
        const ast = await openapiTS(spec);
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
