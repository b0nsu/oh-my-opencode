export class RingBuffer {
  private chunks: string[] = [];
  private totalBytes = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: string): void {
    if (chunk.length === 0) return;
    this.chunks.push(chunk);
    this.totalBytes += Buffer.byteLength(chunk);
    this.trim();
  }

  read(): string {
    return this.chunks.join("");
  }

  private trim(): void {
    while (this.totalBytes > this.maxBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift();
      if (!removed) break;
      this.totalBytes -= Buffer.byteLength(removed);
    }
  }
}
