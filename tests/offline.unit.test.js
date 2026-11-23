import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("guarda un verificador con sal, nunca la contraseña y verifica correctamente", async () => {
    const u = { id: 1, email: "t@test.com", nombre: "T", rol: "tecnico" };
    expect(await guardarUsuarioOffline(u, "clave" )).toBe(true);
    const raw = localStorage.getItem("pmg_offline_user");
    expect(raw).not.toContain('clave');
    const [entry] = JSON.parse(raw);
    expect(entry._pw).toBeUndefined();
    expect(entry._offlineVerifier).toMatchObject({version:1,iterations:210000});
    expect(await verificarUsuarioOffline(" T@TEST.COM ", "clave")).toMatchObject(u);
    expect(await verificarUsuarioOffline("t@test.com", "mala")).toBeNull();
    const oldSalt = entry._offlineVerifier.salt;
    await guardarUsuarioOffline(u, "clave");
    expect(JSON.parse(localStorage.getItem("pmg_offline_user"))[0]._offlineVerifier.salt).not.toEqual(oldSalt);
  });

  it("migra una contraseña antigua al ingresar offline sin perder la cola", async () => {
    localStorage.setItem("pmg_offline_user", JSON.stringify([{ id: 1, email: "t@test.com", rol:"tecnico", _pw:"antigua" }]));
    localStorage.setItem("pmg_offline_queue", '[{"_offlineId":"pendiente"}]');
    expect(await verificarUsuarioOffline("t@test.com", "incorrecta")).toBeNull();
    expect(JSON.parse(localStorage.getItem("pmg_offline_user"))[0]._pw).toBe("antigua");
    expect(await verificarUsuarioOffline("t@test.com", "antigua")).toMatchObject({id:1});
    expect(localStorage.getItem("pmg_offline_user")).not.toContain("antigua");
    expect(offlineQueue()).toEqual([{_offlineId:"pendiente"}]);
  });

  it("no guarda ni conserva una clave offline administrativa", async () => {
    localStorage.setItem("pmg_offline_user", JSON.stringify([{ email: "admin@test.com", rol: "admin", _pw: "anterior" }]));
    await guardarUsuarioOffline({ id: 5, email: "admin@test.com", rol: "administrador" }, "nueva");
    expect(await verificarUsuarioOffline("admin@test.com", "nueva")).toBeNull();
    expect(JSON.parse(localStorage.getItem("pmg_offline_user"))).toEqual([]);
  });

  it("sin WebCrypto conserva la credencial antigua y no guarda una nueva en claro", async () => {
    localStorage.setItem("pmg_offline_user", JSON.stringify([{id:1,email:"t@test.com",rol:"tecnico",_pw:"anterior"}]));
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await guardarUsuarioOffline({id:2,email:"nuevo@test.com",rol:"tecnico"},"nueva")).toBe(false);
      expect(await verificarUsuarioOffline("t@test.com","anterior")).toMatchObject({id:1});
      const saved=JSON.parse(localStorage.getItem("pmg_offline_user"));
      expect(saved).toHaveLength(1);
      expect(saved[0]._pw).toBe("anterior");
    } finally { vi.unstubAllGlobals(); }
  });

  it("si falla la escritura no destruye la contraseña antigua ni la cola", async () => {
    localStorage.setItem("pmg_offline_user", JSON.stringify([{id:1,email:"t@test.com",rol:"tecnico",_pw:"anterior"}]));
    localStorage.setItem("pmg_offline_queue", '[{"_offlineId":"q"}]');
    const set = localStorage.setItem;
    localStorage.setItem = (k,v) => { if (k === 'pmg_offline_user') throw new Error('quota'); set(k,v); };
    expect(await verificarUsuarioOffline("t@test.com","anterior")).toMatchObject({id:1});
    expect(JSON.parse(localStorage.getItem("pmg_offline_user"))[0]._pw).toBe('anterior');
    expect(offlineQueue()).toEqual([{_offlineId:'q'}]);
  });

  it("con verificador malformado rechaza sin usar clave heredada", async () => {
    localStorage.setItem("pmg_offline_user", JSON.stringify([{email:"t@test.com",_pw:"clave",_offlineVerifier:{version:1,iterations:999999999,salt:'0',hash:'0'}}]));
    expect(await verificarUsuarioOffline("t@test.com", "clave")).toBeNull();
  });
});
