import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("acepta una contraseña larga y propia", () => {
    expect(passwordProblem("girasoles de mayo 2025", ["camila@example.com", "Camila"])).toBeNull();
  });

  it("pide un largo entre 10 y 72", () => {
    expect(passwordProblem("corta")).toMatch(/al menos 10/);
    expect(passwordProblem("a".repeat(30) + "b".repeat(30) + "c".repeat(13))).toMatch(/máximo 72/);
  });

  it("rechaza las más usadas y las repetidas", () => {
    expect(passwordProblem("1234567890")).toMatch(/fácil/);
    expect(passwordProblem("TeAmo12345")).toMatch(/fácil/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/fácil/);
    expect(passwordProblem("abababababab")).toMatch(/fácil/);
  });

  it("rechaza el propio nombre o correo", () => {
    expect(passwordProblem("juanito-2025!", ["juanito@example.com"])).toMatch(/nombre ni tu correo/);
    expect(passwordProblem("soy Camila y ya", ["", "Camila"])).toMatch(/nombre ni tu correo/);
  });
});
