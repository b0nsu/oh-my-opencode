import { copyFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { bytesOfFile, ensureDir, sha256OfFile } from "../shared/file-utils";
import type { ArtifactRef } from "../types";

function globLikeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

async function walk(dir: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isFile()) {
      files.push(absolute);
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await walk(absolute, depth - 1);
      files.push(...nested);
    }
  }
  return files;
}

export async function collectCrashArtifacts(args: {
  cwd: string;
  patterns: string[];
  artifactCrashDir: string;
  includeSymbols: string[];
  maxArtifactBytes: number;
}): Promise<{ dumps: ArtifactRef[]; symbols: ArtifactRef[] }> {
  const { cwd, patterns, artifactCrashDir, maxArtifactBytes } = args;
  const regexes = patterns.map(globLikeToRegExp);
  const files = await walk(resolve(cwd), 2);

  await ensureDir(artifactCrashDir);
  const dumps: ArtifactRef[] = [];
  for (const file of files) {
    const fileName = basename(file);
    if (!regexes.some((regex) => regex.test(fileName))) continue;
    const sourceBytes = await bytesOfFile(file);
    if (typeof sourceBytes === "number" && sourceBytes > maxArtifactBytes) {
      process.stderr.write(
        `[oh-my-memory] Skip artifact ${fileName} (${sourceBytes} bytes > maxArtifactBytes=${maxArtifactBytes})\n`,
      );
      continue;
    }
    const target = join(artifactCrashDir, fileName);
    await copyFile(file, target);
    dumps.push({
      name: fileName,
      path: target,
      bytes: await bytesOfFile(target),
      sha256: await sha256OfFile(target),
    });
  }

  const symbols = await collectSymbolArtifacts(cwd, args.includeSymbols, join(artifactCrashDir, "symbols"), maxArtifactBytes);
  return { dumps, symbols };
}

async function collectSymbolArtifacts(
  cwd: string,
  patterns: string[],
  outDir: string,
  maxArtifactBytes: number,
): Promise<ArtifactRef[]> {
  if (patterns.length === 0) return [];
  const files = await walk(resolve(cwd), 4);
  const regexes = patterns.map(globLikeToRegExp);
  const matched = files.filter((file) => regexes.some((regex) => regex.test(file.replace(/\\/g, "/"))));
  if (matched.length === 0) return [];

  await ensureDir(outDir);
  const refs: ArtifactRef[] = [];
  for (const file of matched) {
    const name = basename(file);
    const sourceBytes = await bytesOfFile(file);
    if (typeof sourceBytes === "number" && sourceBytes > maxArtifactBytes) {
      process.stderr.write(
        `[oh-my-memory] Skip symbol artifact ${name} (${sourceBytes} bytes > maxArtifactBytes=${maxArtifactBytes})\n`,
      );
      continue;
    }
    const target = join(outDir, name);
    await copyFile(file, target);
    refs.push({
      name,
      path: target,
      bytes: await bytesOfFile(target),
      sha256: await sha256OfFile(target),
    });
  }
  return refs;
}
