import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";

import type { MetricSupportItem, ResourceSample } from "../types";

function parseLinuxProcIo(pid: number): { readBytes?: number; writeBytes?: number } {
  const path = `/proc/${pid}/io`;
  if (!existsSync(path)) return {};
  try {
    const content = readFileSync(path, "utf-8");
    const readMatch = content.match(/read_bytes:\s*(\d+)/);
    const writeMatch = content.match(/write_bytes:\s*(\d+)/);
    return {
      readBytes: readMatch ? Number(readMatch[1]) : undefined,
      writeBytes: writeMatch ? Number(writeMatch[1]) : undefined,
    };
  } catch {
    return {};
  }
}

function unixSnapshot(pid: number): Partial<ResourceSample> {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "%cpu=,rss=,vsz=,thcount="], {
    encoding: "utf-8",
  });
  if (result.status !== 0) return {};

  const line = result.stdout.trim();
  const fields = line.split(/\s+/).filter(Boolean);
  if (fields.length < 4) return {};

  const cpuPercent = Number(fields[0]);
  const rssKb = Number(fields[1]);
  const vszKb = Number(fields[2]);
  const threadCount = Number(fields[3]);

  return {
    cpuPercent: Number.isFinite(cpuPercent) ? cpuPercent : undefined,
    rssBytes: Number.isFinite(rssKb) ? rssKb * 1024 : 0,
    vszBytes: Number.isFinite(vszKb) ? vszKb * 1024 : undefined,
    threadCount: Number.isFinite(threadCount) ? threadCount : undefined,
  };
}

function processTreeSize(pid: number): number | undefined {
  if (process.platform === "win32") return undefined;
  const result = spawnSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf-8" });
  if (result.status !== 0) return undefined;

  const parentMap = new Map<number, number[]>();
  const lines = result.stdout.trim().split(/\r?\n/);
  for (const line of lines) {
    const [childText, parentText] = line.trim().split(/\s+/);
    const child = Number(childText);
    const parent = Number(parentText);
    if (!Number.isFinite(child) || !Number.isFinite(parent)) continue;
    const list = parentMap.get(parent) ?? [];
    list.push(child);
    parentMap.set(parent, list);
  }

  const stack = [pid];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const children = parentMap.get(current) ?? [];
    for (const child of children) stack.push(child);
  }

  return seen.size;
}

export function collectProcessSample(pid: number): ResourceSample {
  const unix = process.platform === "win32" ? {} : unixSnapshot(pid);
  const io = process.platform === "linux" ? parseLinuxProcIo(pid) : {};

  return {
    timestamp: new Date().toISOString(),
    pid,
    rssBytes: unix.rssBytes ?? process.memoryUsage().rss,
    vszBytes: unix.vszBytes,
    cpuPercent: unix.cpuPercent,
    ioReadBytes: io.readBytes,
    ioWriteBytes: io.writeBytes,
    threadCount: unix.threadCount,
    processTreeSize: processTreeSize(pid),
  };
}

export function platformInfo() {
  return {
    os: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    bunVersion: typeof Bun !== "undefined" ? Bun.version : undefined,
    hostCpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  };
}

export function metricSupportMatrix(): MetricSupportItem[] {
  const onWindows = process.platform === "win32";
  const onLinux = process.platform === "linux";

  return [
    {
      metric: "rssBytes",
      mode: "native",
      reason: onWindows ? "process.memoryUsage fallback" : "ps rss",
    },
    {
      metric: "cpuPercent",
      mode: onWindows ? "unsupported" : "native",
      reason: onWindows ? "ps collector unavailable on win32" : "ps %cpu",
    },
    {
      metric: "vszBytes",
      mode: onWindows ? "unsupported" : "native",
      reason: onWindows ? "ps collector unavailable on win32" : "ps vsz",
    },
    {
      metric: "ioReadBytes",
      mode: onLinux ? "native" : "unsupported",
      reason: onLinux ? "/proc/<pid>/io" : "linux procfs only",
    },
    {
      metric: "ioWriteBytes",
      mode: onLinux ? "native" : "unsupported",
      reason: onLinux ? "/proc/<pid>/io" : "linux procfs only",
    },
    {
      metric: "threadCount",
      mode: onWindows ? "unsupported" : "native",
      reason: onWindows ? "ps collector unavailable on win32" : "ps thcount",
    },
    {
      metric: "processTreeSize",
      mode: onWindows ? "unsupported" : "native",
      reason: onWindows ? "ps process tree unavailable on win32" : "ps parent-child scan",
    },
  ];
}
