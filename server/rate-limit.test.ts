import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("permite até o limite e bloqueia depois", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1_000 });
    const now = 1_000;

    expect(check("ip", now)).toMatchObject({ allowed: true, remaining: 1 });
    expect(check("ip", now)).toMatchObject({ allowed: true, remaining: 0 });
    expect(check("ip", now)).toMatchObject({ allowed: false, retryAfter: 1 });
  });

  it("libera novamente quando a janela expira", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 500).allowed).toBe(false);
    expect(check("ip", 1_000).allowed).toBe(true);
  });

  it("isola o limite por chave (IP)", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 10_000 });

    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 0).allowed).toBe(false);
    expect(check("b", 0).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prioriza o cabeçalho do Netlify", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1",
    });

    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("usa o primeiro IP de x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" })).toBe("198.51.100.7");
  });

  it("cai para unknown quando não há cabeçalho", () => {
    expect(clientIp({})).toBe("unknown");
  });
});
