import { describe, it, expect, beforeEach } from "vitest";
import {
  offlineQueue,
  offlineSave,
  offlinePedidos,
  offlinePedidosSave,
  guardarUsuarioOffline,
  verificarUsuarioOffline,
} from "../offline.js";

function createMemoryLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

describe("offline.js — cola y pedidos", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryLocalStorage();
  });

  it("offlineSave / offlineQueue roundtrip", () => {
    offlineSave([{ tipo: "test", id: 1 }]);
    expect(offlineQueue()).toEqual([{ tipo: "test", id: 1 }]);
  });

  it("offlinePedidosSave / offlinePedidos roundtrip", () => {
    offlinePedidosSave([{ np: "2026-1" }]);
    expect(offlinePedidos()).toEqual([{ np: "2026-1" }]);
  });
});

describe("offline.js — usuario offline", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryLocalStorage();
  });

  it("guardarUsuarioOffline y verificarUsuarioOffline", () => {
    const u = { id: 1, email: "t@test.com", nombre: "T" };
    guardarUsuarioOffline(u, "clave");
    const found = verificarUsuarioOffline("t@test.com", "clave");
    expect(found).toMatchObject({ email: "t@test.com", nombre: "T" });
    expect(verificarUsuarioOffline("t@test.com", "mala")).toBeNull();
  });
});
