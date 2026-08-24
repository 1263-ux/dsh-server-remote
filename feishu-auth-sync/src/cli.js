import { configFromEnv, syncOnce } from "./sync.js";

try {
  const result = await syncOnce({ config: configFromEnv() });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "VALID" ? 0 : 1;
} catch (error) {
  process.stderr.write(`Feishu auth sync configuration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
