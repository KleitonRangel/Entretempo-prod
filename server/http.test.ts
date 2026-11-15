import { afterEach, describe, expect, it, vi } from "vitest";
import { cached } from "./http";

afterEach(() => {
  vi.useRealTimers();
});

describe("cached", () => {
  it("reaproveita o resultado dentro do TTL", async () => {
    const load = vi.fn().mockResolvedValue({ value: 42 });

    const first = await cached("cache:reuse", 60_000, load);
    const second = await cached("cache:reuse", 60_000, load);

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("deduplica chamadas simultâneas", async () => {
    const load = vi.fn().mockResolvedValue("ok");

    const [first, second, third] = await Promise.all([
      cached("cache:dedupe", 60_000, load),
      cached("cache:dedupe", 60_000, load),
      cached("cache:dedupe", 60_000, load),
    ]);

    expect([first, second, third]).toEqual(["ok", "ok", "ok"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("recarrega depois que o TTL expira", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const load = vi.fn().mockResolvedValueOnce("antigo").mockResolvedValueOnce("novo");

    expect(await cached("cache:expira", 1_000, load)).toBe("antigo");
    vi.setSystemTime(2_000);
    expect(await cached("cache:expira", 1_000, load)).toBe("novo");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("não guarda resultado de erro", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("falhou")).mockResolvedValueOnce("ok");

    await expect(cached("cache:erro", 60_000, load)).rejects.toThrow("falhou");
    await expect(cached("cache:erro", 60_000, load)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
