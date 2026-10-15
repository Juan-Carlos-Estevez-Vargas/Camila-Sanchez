import { describe, expect, it } from "vitest";
import { placePopover, spotlightBox } from "./tourLayout";

const desktop = { width: 1280, height: 800 };
const card = { width: 360, height: 200 };

describe("posición del tutorial", () => {
  it("el resaltado deja aire alrededor y no se sale de la pantalla", () => {
    expect(spotlightBox({ top: 100, left: 100, width: 50, height: 20 }, desktop)).toEqual({ top: 92, left: 92, width: 66, height: 36 });
    expect(spotlightBox({ top: 2, left: 1250, width: 100, height: 40 }, desktop)).toEqual({ top: 0, left: 1242, width: 38, height: 50 });
  });

  it("sin destino, la tarjeta va centrada", () => {
    expect(placePopover(null, card, desktop)).toEqual({ placement: "center", top: 300, left: 460 });
  });

  it("va debajo del destino si cabe y encima si no", () => {
    expect(placePopover({ top: 50, left: 600, width: 80, height: 40 }, card, desktop))
      .toEqual({ placement: "below", top: 102, left: 460 });
    expect(placePopover({ top: 700, left: 600, width: 80, height: 40 }, card, desktop))
      .toEqual({ placement: "above", top: 488, left: 460 });
  });

  it("nunca se sale por los lados", () => {
    expect(placePopover({ top: 50, left: 1240, width: 30, height: 30 }, card, desktop).left).toBe(1280 - 360 - 12);
    expect(placePopover({ top: 50, left: 0, width: 30, height: 30 }, card, desktop).left).toBe(12);
  });

  it("en pantallas angostas se ancla abajo, o arriba si el destino está abajo", () => {
    const phone = { width: 390, height: 800 };
    expect(placePopover({ top: 100, left: 10, width: 100, height: 40 }, card, phone)).toEqual({ placement: "sheet", top: 588, left: 12 });
    expect(placePopover({ top: 700, left: 10, width: 100, height: 40 }, card, phone)).toEqual({ placement: "sheet", top: 12, left: 12 });
  });
});
