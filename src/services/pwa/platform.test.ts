import { describe, expect, it } from "vitest";
import { detectPlatform, isIos, isIosSafari } from "./platform";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("plataforma para instalar la app", () => {
  it("reconoce iPhone, Android y computador", () => {
    expect(detectPlatform({ userAgent: IPHONE_SAFARI })).toBe("ios");
    expect(detectPlatform({ userAgent: ANDROID })).toBe("android");
    expect(detectPlatform({ userAgent: WINDOWS })).toBe("desktop");
    expect(detectPlatform({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe("desktop");
  });

  it("un iPad nuevo se presenta como Mac con pantalla táctil", () => {
    expect(isIos({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  });

  it("distingue Safari de otros navegadores del iPhone", () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI })).toBe(true);
    expect(isIosSafari({ userAgent: IPHONE_CHROME })).toBe(false);
    expect(isIosSafari({ userAgent: ANDROID })).toBe(false);
  });
});
