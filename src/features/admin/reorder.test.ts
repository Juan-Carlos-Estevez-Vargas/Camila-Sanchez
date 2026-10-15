import { expect, it } from "vitest";
import { move } from "./reorder";

it("mueve elementos sin mutar el original", () => {
  const list = ["a", "b", "c", "d"];
  expect(move(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  expect(move(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
  expect(move(list, 1, 9)).toEqual(list);
  expect(list).toEqual(["a", "b", "c", "d"]);
});
