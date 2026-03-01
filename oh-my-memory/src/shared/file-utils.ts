import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, value, "utf-8");
}

export async function sha256OfFile(filePath: string): Promise<string | undefined> {
  try {
    const data = await readFile(filePath);
    return createHash("sha256").update(data).digest("hex");
  } catch {
    return undefined;
  }
}

export async function bytesOfFile(filePath: string): Promise<number | undefined> {
  try {
    const value = await stat(filePath);
    return value.size;
  } catch {
    return undefined;
  }
}
