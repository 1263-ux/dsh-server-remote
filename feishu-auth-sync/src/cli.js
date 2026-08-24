import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { configFromEnv, syncOnce } from "./sync.js";

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt$65536$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

if (process.argv[2] === "hash-password") {
  const password = (await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
  }));
  if (!password) {
    process.stderr.write("password must not be empty\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`${await hashPassword(password)}\n`);
  }
} else {
  try {
    const result = await syncOnce({ config: configFromEnv() });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.status === "VALID" ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Feishu auth sync configuration failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
