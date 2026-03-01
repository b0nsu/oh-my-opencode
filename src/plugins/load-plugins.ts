import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { CollectorPlugin, ReporterPlugin } from "../types";

export interface PluginLoadIssue {
  path: string;
  reason: "non_local" | "missing" | "import_error" | "invalid_shape";
}

export interface LoadedPluginsResult<T> {
  plugins: T[];
  issues: PluginLoadIssue[];
}

function resolveLocalPluginPath(cwd: string, value: string): string | undefined {
  if (value.includes("://")) return undefined;
  return isAbsolute(value) ? value : resolve(cwd, value);
}

async function loadOne(path: string): Promise<{ module?: unknown; reason?: PluginLoadIssue["reason"] }> {
  try {
    const moduleUrl = pathToFileURL(path).href;
    const imported = await import(moduleUrl);
    if (imported?.default) return { module: imported.default };
    return { module: imported };
  } catch {
    return { reason: "import_error" };
  }
}

export async function loadCollectorPlugins(cwd: string, paths: string[]): Promise<LoadedPluginsResult<CollectorPlugin>> {
  const plugins: CollectorPlugin[] = [];
  const issues: PluginLoadIssue[] = [];
  for (const item of paths) {
    const resolved = resolveLocalPluginPath(cwd, item);
    if (!resolved) {
      issues.push({ path: item, reason: "non_local" });
      continue;
    }
    if (!existsSync(resolved)) {
      issues.push({ path: resolved, reason: "missing" });
      continue;
    }
    const loaded = await loadOne(resolved);
    if (loaded.reason) {
      issues.push({ path: resolved, reason: loaded.reason });
      continue;
    }
    if (!loaded.module || typeof loaded.module !== "object") {
      issues.push({ path: resolved, reason: "invalid_shape" });
      continue;
    }
    const candidate = loaded.module as CollectorPlugin;
    if (typeof candidate.collectSample === "function") {
      plugins.push(candidate);
    } else {
      issues.push({ path: resolved, reason: "invalid_shape" });
    }
  }
  return { plugins, issues };
}

export async function loadReporterPlugins(cwd: string, paths: string[]): Promise<LoadedPluginsResult<ReporterPlugin>> {
  const plugins: ReporterPlugin[] = [];
  const issues: PluginLoadIssue[] = [];
  for (const item of paths) {
    const resolved = resolveLocalPluginPath(cwd, item);
    if (!resolved) {
      issues.push({ path: item, reason: "non_local" });
      continue;
    }
    if (!existsSync(resolved)) {
      issues.push({ path: resolved, reason: "missing" });
      continue;
    }
    const loaded = await loadOne(resolved);
    if (loaded.reason) {
      issues.push({ path: resolved, reason: loaded.reason });
      continue;
    }
    if (!loaded.module || typeof loaded.module !== "object") {
      issues.push({ path: resolved, reason: "invalid_shape" });
      continue;
    }
    const candidate = loaded.module as ReporterPlugin;
    if (typeof candidate.onReport === "function") {
      plugins.push(candidate);
    } else {
      issues.push({ path: resolved, reason: "invalid_shape" });
    }
  }
  return { plugins, issues };
}

export function inspectPluginPaths(cwd: string, paths: string[]): Array<{ requestedPath: string; resolvedPath?: string; ok: boolean; reason: string }> {
  return paths.map((item) => {
    const resolved = resolveLocalPluginPath(cwd, item);
    if (!resolved) {
      return { requestedPath: item, ok: false, reason: "non_local" };
    }
    if (!existsSync(resolved)) {
      return { requestedPath: item, resolvedPath: resolved, ok: false, reason: "missing" };
    }
    return { requestedPath: item, resolvedPath: resolved, ok: true, reason: "exists" };
  });
}
