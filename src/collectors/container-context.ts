import { existsSync, readFileSync } from "node:fs";

export interface ContainerContext {
  inContainer: boolean;
  runtime?: "docker" | "kubernetes" | "unknown";
  memoryLimitBytes?: number;
}

function parseMemoryLimitFromCgroup(): number | undefined {
  const paths = [
    "/sys/fs/cgroup/memory.max",
    "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  ];

  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const value = readFileSync(path, "utf-8").trim();
      if (value === "max") return undefined;
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function detectContainerContext(): ContainerContext {
  const hasDockerEnv = existsSync("/.dockerenv");
  const cgroupPath = "/proc/1/cgroup";

  let runtime: ContainerContext["runtime"];
  let inContainer = false;

  if (hasDockerEnv) {
    inContainer = true;
    runtime = "docker";
  }

  if (existsSync(cgroupPath)) {
    try {
      const cgroup = readFileSync(cgroupPath, "utf-8");
      if (cgroup.includes("kubepods")) {
        inContainer = true;
        runtime = "kubernetes";
      } else if (cgroup.includes("docker")) {
        inContainer = true;
        runtime = runtime ?? "docker";
      }
    } catch {
      // best effort only
    }
  }

  return {
    inContainer,
    runtime: inContainer ? runtime ?? "unknown" : undefined,
    memoryLimitBytes: parseMemoryLimitFromCgroup(),
  };
}
