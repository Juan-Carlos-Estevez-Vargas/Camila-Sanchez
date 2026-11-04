import { describe, expect, it } from "vitest";
import { parseDonationUrl } from "./donation";

describe("parseDonationUrl", () => {
  it("sin valor no hay botón", () => {
    expect(parseDonationUrl(undefined)).toBeNull();
    expect(parseDonationUrl("   ")).toBeNull();
  });

  it("reconoce las plataformas conocidas", () => {
    expect(parseDonationUrl("https://ko-fi.com/juank")).toEqual({ url: "https://ko-fi.com/juank", platform: "Ko-fi" });
    expect(parseDonationUrl(" https://www.buymeacoffee.com/juank ")?.platform).toBe("Buy Me a Coffee");
    expect(parseDonationUrl("https://github.com/sponsors/juank")?.platform).toBe("GitHub Sponsors");
    expect(parseDonationUrl("https://paypal.me/juank")?.platform).toBe("PayPal");
  });

  it("con otra plataforma usa el dominio como nombre", () => {
    expect(parseDonationUrl("https://www.donar.example/juan")?.platform).toBe("donar.example");
  });

  it("rechaza enlaces que no son https o traen credenciales", () => {
    expect(parseDonationUrl("http://ko-fi.com/juank")).toBeNull();
    expect(parseDonationUrl("javascript:alert(1)")).toBeNull();
    expect(parseDonationUrl("https://user:pass@ko-fi.com/juank")).toBeNull();
    expect(parseDonationUrl("ko-fi.com/juank")).toBeNull();
  });
});
