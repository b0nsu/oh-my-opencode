export type RunStage = "pre-test" | "during-test" | "post-test" | "build" | "custom";

export interface ResourceSample {
  timestamp: string;
  pid: number;
  rssBytes: number;
  vszBytes?: number;
  cpuPercent?: number;
  ioReadBytes?: number;
  ioWriteBytes?: number;
  threadCount?: number;
  processTreeSize?: number;
}

export interface ArtifactRef {
  name: string;
  path: string;
  bytes?: number;
  sha256?: string;
  contentType?: string;
}

export interface AnalysisFinding {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: string[];
}

export interface CrashArtifact {
  detected: boolean;
  signal?: string;
  exitCode: number | null;
  dumps: ArtifactRef[];
  symbols: ArtifactRef[];
}

export interface RunSummary {
  event: string;
  severity: "low" | "medium" | "high" | "critical";
  reproductionPriority: "P0" | "P1" | "P2" | "P3";
  recommendedActions: string[];
}

export interface RunReport {
  schemaVersion: "1.0.0";
  runId: string;
  createdAt: string;
  stage: RunStage;
  label?: string;
  command: string[];
  cwd: string;
  ci: boolean;
  platform: {
    os: string;
    arch: string;
    nodeVersion: string;
    bunVersion?: string;
  };
  container: {
    inContainer: boolean;
    runtime?: "docker" | "kubernetes" | "unknown";
    memoryLimitBytes?: number;
  };
  durationMs: number;
  status: "success" | "failed";
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  samples: ResourceSample[];
  crash: CrashArtifact;
  findings: AnalysisFinding[];
  artifacts: ArtifactRef[];
  summary: RunSummary;
}

export interface OhMyMemoryConfig {
  outDir: string;
  sampleIntervalMs: number;
  maxSamples: number;
  logTailBytes: number;
  crashPatterns: string[];
  symbolGlobs: string[];
  baselineFile: string;
  baselineThresholds: {
    regressionRssBytes: number;
    regressionDurationMs: number;
    improvementRssBytes: number;
    improvementDurationMs: number;
  };
  failOnSeverity?: "high" | "critical";
  sentryDsn?: string;
  sentryDsnEnv: string;
}

export interface RunOptions {
  stage: RunStage;
  label?: string;
  command: string[];
  cwd: string;
}
