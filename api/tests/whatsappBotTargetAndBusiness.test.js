import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const memConfig = new Map();
const mockQuery = vi.fn();

vi.mock("../db/neon.js", () => ({
  query: (...args) => mockQuery(...args),
}));

vi.mock("../services/configuracionStore.js", () => ({
  getConfiguracion: vi.fn(async (key) => memConfig.get(key) ?? null),
  setConfiguracion: vi.fn(async (key, val) => {
    memConfig.set(key, val);
  }),
}));

vi.mock("../services/pipelineGeocodificacionPedido.js", () => ({
  resolverCoordenadasCandidatoWhatsapp: vi.fn(async () => ({
    success: true,
    lat: -31.73,
    lng: -60.52,
    fuente: "gps_usuario",
    fuente_final: "gps_usuario",
    log: [],
    pasos: [],
    errores: [],
    geocoding_audit: null,
  })),
}));

vi.mock("../services/nominatimClient.js", () => ({
  geocodeCalleNumeroLocalidadArgentina: vi.fn(async () => null),
  geocodeDomicilioSimpleQArgentina: vi.fn(async () => null),
  reverseGeocodeArgentina: vi.fn(async () => ({
    barrio: "Centro",
    state: "Entre Ríos",
    postcode: "3127",
  })),
}));

import {
  __resetWhatsappBotTargetCacheForTests,
  getWhatsappBotActiveTarget,
  syncWhatsappBotActiveTarget,
} from "../services/whatsappBotTargetStore.js";
import {
  resolveWhatsappBotTarget,
  resolveTenantIdByMetaPhoneNumberId,
} from "../services/metaTenantWhatsapp.js";
import { loadTenantBotContext } from "../services/whatsappBotMeta.js";
import {
  crearPedidoDesdeWhatsappBot,
  __resetPedidosColsCacheForTests,
} from "../services/pedidoWhatsappBot.js";
import { buscarIdentidadParaReclamoWhatsApp } from "../services/whatsappReclamanteLookup.js";

const SAVED_ENV = { ...process.env };

function setupTenantsMock({
  tenant1Tipo = "cooperativa_electrica",
  tenant1ActiveBt = "electricidad",
  tenant2Tipo = "cooperativa_agua",
  tenant2ActiveBt = "agua",
} = {}) {
  mockQuery.mockImplementation(async (sql, params = []) => {
    const s = String(sql || "");
    if (s.includes("information_schema.columns")) {
      if (s.includes("table_name = 'clientes'") && s.includes("active_business_type")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (s.includes("table_name = 'tenant_active_business'")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (s.includes("table_name = 'pedidos'") && !s.includes("column_name =")) {
        return {
          rows: [
            "id",
            "numero_pedido",
            "cliente",
            "cliente_nombre",
            "tipo_trabajo",
            "descripcion",
            "prioridad",
            "estado",
            "avance",
            "lat",
            "lng",
            "usuario_id",
            "usuario_creador_id",
            "telefono_contacto",
            "tenant_id",
            "business_type",
            "origen_reclamo",
          ].map((column_name) => ({ column_name })),
        };
      }
      if (s.includes("table_name = 'pedidos'") && s.includes("business_type")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (s.includes("table_name = 'usuarios'")) {
        return { rows: [{ column_name: "tenant_id" }] };
      }
      if (s.includes("table_name = 'socios_catalogo'") || params[0] === "socios_catalogo") {
        return {
          rows: [
            { column_name: "id", data_type: "integer", udt_name: "int4" },
            { column_name: "nis_medidor", data_type: "text", udt_name: "text" },
            { column_name: "nis", data_type: "text", udt_name: "text" },
            { column_name: "medidor", data_type: "text", udt_name: "text" },
            { column_name: "nombre", data_type: "text", udt_name: "text" },
            { column_name: "calle", data_type: "text", udt_name: "text" },
            { column_name: "numero", data_type: "text", udt_name: "text" },
            { column_name: "localidad", data_type: "text", udt_name: "text" },
            { column_name: "tipo_conexion", data_type: "text", udt_name: "text" },
            { column_name: "fases", data_type: "text", udt_name: "text" },
            { column_name: "latitud", data_type: "numeric", udt_name: "numeric" },
            { column_name: "longitud", data_type: "numeric", udt_name: "numeric" },
            { column_name: "tenant_id", data_type: "integer", udt_name: "int4" },
            { column_name: "cliente_id", data_type: "integer", udt_name: "int4" },
            { column_name: "business_type", data_type: "text", udt_name: "text" },
            { column_name: "activo", data_type: "boolean", udt_name: "bool" },
          ],
        };
      }
      return { rows: [] };
    }

    if (s.includes("information_schema.tables")) {
      if (params[0] === "socios_catalogo") return { rows: [{ "?column?": 1 }] };
      return { rows: [] };
    }

    if (s.includes("FROM tenant_active_business")) {
      const tid = Number(params[0]);
      if (tid === 1) return { rows: [{ active_business_type: tenant1ActiveBt }] };
      if (tid === 2) return { rows: [{ active_business_type: tenant2ActiveBt }] };
      if (tid === 3) return { rows: [{ active_business_type: "municipio" }] };
      return { rows: [] };
    }

    if (s.includes("FROM clientes")) {
      if (s.includes("meta_phone_id")) {
        // Simula el caso real: setupWizard movió meta_phone_id al tenant 2 (cooperativa de agua)
        if (params[0] === "OLD_META_PHONE_ID") {
          return { rows: [{ id: 2 }] };
        }
        if (params[0] === "DEDICATED_META_3") {
          return { rows: [{ id: 3 }] };
        }
        return { rows: [] };
      }
      if (s.includes("ORDER BY (CASE WHEN id = 1")) {
        return { rows: [{ id: 1 }] };
      }
      const tid = Number(params[0]);
      if (tid === 1) {
        return {
          rows: [
            {
              id: 1,
              nombre: "Cooperativa Eléctrica Tenant 1",
              tipo: tenant1Tipo,
              active_business_type: tenant1ActiveBt,
              activo: true,
              configuracion: { lat_base: -31.73, lng_base: -60.52, provincia: "Entre Ríos" },
            },
          ],
        };
      }
      if (tid === 2) {
        return {
          rows: [
            {
              id: 2,
              nombre: "Cooperativa de Agua Tenant 2",
              tipo: tenant2Tipo,
              active_business_type: tenant2ActiveBt,
              activo: true,
              configuracion: { meta_phone_id: "OLD_META_PHONE_ID" },
            },
          ],
        };
      }
      if (tid === 3) {
        return {
          rows: [
            {
              id: 3,
              nombre: "Municipalidad Tenant 3",
              tipo: "municipio",
              active_business_type: "municipio",
              activo: true,
              configuracion: {},
            },
          ],
        };
      }
      return { rows: [] };
    }

    if (s.includes("FROM usuarios")) {
      return { rows: [{ id: 10, nombre: "Admin T1", email: "admin" }] };
    }

    if (s.includes("pedido_contador") || s.includes("MAX(")) {
      return { rows: [{ ultimo_numero: 42 }] };
    }

    if (s.includes("INSERT INTO pedidos")) {
      return {
        rows: [
          {
            id: 501,
            numero_pedido: "2026-0042",
            tenant_id: params[params.length - 3],
          },
        ],
      };
    }

    if (s.includes("FROM socios_catalogo")) {
      // Verifica que el SQL incluye tenant y business_type
      return {
        rows: [
          {
            nis_medidor: "41686",
            nis_raw: "41686",
            medidor_raw: "99881",
            nombre: "Juan Pérez",
            calle_cat: "San Martín",
            numero_cat: "123",
            localidad_cat: "El Pingo",
            tipo_conexion_cat: "Aérea",
            fases_cat: "Monofásica",
            lat_pad: -31.73,
            lng_pad: -60.52,
            provincia_cat: "Entre Ríos",
            codigo_postal_cat: "3127",
          },
        ],
      };
    }

    return { rows: [] };
  });
}

describe("WhatsApp bot — targeting dinámico de tenant_id y business_type", () => {
  beforeEach(() => {
    memConfig.clear();
    mockQuery.mockReset();
    __resetWhatsappBotTargetCacheForTests();
    __resetPedidosColsCacheForTests();
    process.env = { ...SAVED_ENV };
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it("en Baileys NO hereda un tenant de agua por META_PHONE_NUMBER_ID ni WHATSAPP_BOT_TENANT_ID viejos y apunta a tenant 1 (electricidad)", async () => {
    process.env.WHATSAPP_PROVIDER = "baileys";
    process.env.META_PHONE_NUMBER_ID = "OLD_META_PHONE_ID";
    process.env.WHATSAPP_BOT_TENANT_ID = "2"; // viejo env apuntando a agua
    delete process.env.BAILEYS_TENANT_ID;

    setupTenantsMock();

    const target = await resolveWhatsappBotTarget("baileys-bot");
    expect(target).toMatchObject({
      tenantId: 1,
      businessType: "electricidad",
      rubro: "cooperativa_electrica",
      tenantNombre: "Cooperativa Eléctrica Tenant 1",
    });

    const tid = await resolveTenantIdByMetaPhoneNumberId("baileys-bot");
    expect(tid).toBe(1);
  });

  it("sincroniza el destino del bot al loguearse o cambiar business_type (electricidad -> agua -> municipio)", async () => {
    process.env.WHATSAPP_PROVIDER = "baileys";
    setupTenantsMock();

    // Login en tenant_id: 1 (cooperativa eléctrica)
    const t1 = await syncWhatsappBotActiveTarget({
      tenantId: 1,
      source: "auth_login",
      userId: 10,
    });
    expect(t1).toMatchObject({
      tenantId: 1,
      businessType: "electricidad",
      rubro: "cooperativa_electrica",
    });

    const resolved1 = await resolveWhatsappBotTarget("baileys-bot");
    expect(resolved1).toMatchObject({
      tenantId: 1,
      businessType: "electricidad",
      rubro: "cooperativa_electrica",
    });

    // Cambio de línea de negocio en el mismo tenant 1 -> agua
    await syncWhatsappBotActiveTarget({
      tenantId: 1,
      businessType: "agua",
      source: "tenant_switch_business",
      userId: 10,
      force: true,
    });

    const ctxAgua = await loadTenantBotContext(1);
    expect(ctxAgua?.businessType).toBe("agua");
    expect(ctxAgua?.tipo).toBe("cooperativa_agua");
    expect(ctxAgua?.tipos).toContain("Corte de suministro de agua");

    // Login posterior en tenant 3 (municipio)
    await syncWhatsappBotActiveTarget({
      tenantId: 3,
      source: "auth_login",
      userId: 33,
      force: true,
    });

    const resolved3 = await resolveWhatsappBotTarget("baileys-bot");
    expect(resolved3).toMatchObject({
      tenantId: 3,
      businessType: "municipio",
      rubro: "municipio",
    });

    const ctxMuni = await loadTenantBotContext(3);
    expect(ctxMuni?.businessType).toBe("municipio");
    expect(ctxMuni?.tipo).toBe("municipio");
  });

  it("respeta locked=true hasta que un admin desbloquee o fuerce el cambio", async () => {
    setupTenantsMock();

    await syncWhatsappBotActiveTarget({
      tenantId: 1,
      businessType: "electricidad",
      locked: true,
      force: true,
      source: "api_pin",
    });

    // Intento automático sin force no pisa el lock
    const afterAuto = await syncWhatsappBotActiveTarget({
      tenantId: 2,
      businessType: "agua",
      source: "auth_login",
    });
    expect(afterAuto?.tenantId).toBe(1);
    expect(afterAuto?.businessType).toBe("electricidad");

    // Desbloqueo explícito sí actualiza
    const afterUnlock = await syncWhatsappBotActiveTarget({
      tenantId: 2,
      businessType: "agua",
      locked: false,
      source: "api_unpin",
    });
    expect(afterUnlock?.tenantId).toBe(2);
    expect(afterUnlock?.businessType).toBe("agua");
    expect(afterUnlock?.locked).toBe(false);
    expect((await getWhatsappBotActiveTarget())?.tenantId).toBe(2);
  });

  it("en Meta dedicado (phone_number_id propio distinto del global) resuelve el tenant dueño del canal y su business_type", async () => {
    process.env.WHATSAPP_PROVIDER = "meta";
    process.env.META_PHONE_NUMBER_ID = "SHARED_TEST_LINE";
    setupTenantsMock();

    await syncWhatsappBotActiveTarget({
      tenantId: 1,
      businessType: "electricidad",
      source: "auth_login",
    });

    const dedicated = await resolveWhatsappBotTarget("DEDICATED_META_3");
    expect(dedicated).toMatchObject({
      tenantId: 3,
      businessType: "municipio",
      rubro: "municipio",
    });

    const shared = await resolveWhatsappBotTarget("SHARED_TEST_LINE");
    expect(shared).toMatchObject({
      tenantId: 1,
      businessType: "electricidad",
    });
  });

  it("crearPedidoDesdeWhatsappBot persiste tenant_id y business_type y valida tipos según businessType activo", async () => {
    setupTenantsMock();

    // Rechaza tipo de agua cuando businessType es electricidad
    await expect(
      crearPedidoDesdeWhatsappBot({
        tenantId: 1,
        tipoCliente: "cooperativa_agua", // aunque quedara viejo, manda businessType='electricidad'
        businessType: "electricidad",
        tipoTrabajo: "Corte de suministro de agua",
        descripcion: "Sin agua",
        telefonoContacto: "5493434123456",
        lat: -31.73,
        lng: -60.52,
      })
    ).rejects.toThrow("tipo_trabajo_invalido");

    // Acepta reclamo eléctrico y guarda tenant_id=1 + business_type='electricidad'
    await crearPedidoDesdeWhatsappBot({
      tenantId: 1,
      tipoCliente: "cooperativa_electrica",
      businessType: "electricidad",
      tipoTrabajo: "Corte de Energía",
      descripcion: "Luminaria apagada frente a la plaza",
      telefonoContacto: "5493434123456",
      lat: -31.73,
      lng: -60.52,
      contactName: "María Gómez",
      clienteCalle: "San Martín",
      clienteNumeroPuerta: "250",
      clienteLocalidad: "El Pingo",
      provincia: "Entre Ríos",
    });

    const insertCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql || "").includes("INSERT INTO pedidos")
    );
    expect(insertCall).toBeTruthy();
    const [insertSql, insertVals] = insertCall;
    expect(insertSql).toContain("tenant_id");
    expect(insertSql).toContain("business_type");
    expect(insertVals).toContain(1);
    expect(insertVals).toContain("electricidad");
    expect(insertVals).toContain("whatsapp");
  });

  it("buscarIdentidadParaReclamoWhatsApp filtra socios_catalogo por COALESCE(tenant_id, cliente_id) y business_type sin fugas entre tenants", async () => {
    setupTenantsMock();

    const res = await buscarIdentidadParaReclamoWhatsApp(1, "41686", {
      businessType: "electricidad",
    });
    expect(res).toMatchObject({
      ok: true,
      clienteNombre: "Juan Pérez",
      nis: "41686",
    });

    const scCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql || "").includes("FROM socios_catalogo")
    );
    expect(scCalls.length).toBe(1);
    const [scSql, scParams] = scCalls[0];
    expect(scSql).toContain("COALESCE(tenant_id, cliente_id)");
    expect(scSql).toContain("business_type");
    expect(scSql).not.toContain("ELSE 2");
    expect(scParams).toContain(1);
    expect(scParams).toContain("electricidad");
  });
});
