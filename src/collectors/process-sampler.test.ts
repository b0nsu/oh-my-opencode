import { describe, expect, it } from "bun:test";

import { metricSupportMatrix } from "./process-sampler";

describe("metricSupportMatrix", () => {
  it("includes full metric contract", () => {
    const metrics = metricSupportMatrix();
    const names = new Set(metrics.map((item) => item.metric));

    expect(names.has("rssBytes")).toBe(true);
    expect(names.has("cpuPercent")).toBe(true);
    expect(names.has("vszBytes")).toBe(true);
    expect(names.has("ioReadBytes")).toBe(true);
    expect(names.has("ioWriteBytes")).toBe(true);
    expect(names.has("threadCount")).toBe(true);
    expect(names.has("processTreeSize")).toBe(true);
  });
});
