import { describe, it, expect } from "vitest";
import { fajaArgentinaPorLongitud } from "../map.js";

describe("map.js — fajaArgentinaPorLongitud", () => {
  it("longitud fuera de rango finito devuelve 4", () => {
    expect(fajaArgentinaPorLongitud(NaN)).toBe(4);
  });

  it("Entre Ríos (~-59) → faja 5", () => {
    expect(fajaArgentinaPorLongitud(-59)).toBe(5);
  });

  it("límites aproximados de franjas", () => {
    expect(fajaArgentinaPorLongitud(-72)).toBe(1);
    expect(fajaArgentinaPorLongitud(-54)).toBe(7);
  });
});
