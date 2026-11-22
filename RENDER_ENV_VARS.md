# Variables de entorno — Render (API GestorNova / Nexxo)

**Servicio típico:** `nexxo-api-418k.onrender.com` (ajustar si el nombre del servicio cambió).

## WhatsApp — Baileys, Whapi o Meta

| Variable | Uso |
|----------|-----|
| **`WHATSAPP_PROVIDER`** | Nombre **exacto** (sin typos). Valores: `baileys`, `whapi`, `meta`, `waha`, `evolution`. Si no está definida en Render, el código usa **`meta`** por defecto. |
| **Baileys** | `WHATSAPP_PROVIDER=baileys` + opcional `BAILEYS_SESSION_ID` (`default`), `WHATSAPP_WEBHOOK_TOKEN` (protege `/baileys/*`). Al abrir `GET /api/webhooks/whatsapp/baileys/qr?token=...` podés elegir y fijar el **`tenant_id` (número)** y su tipo de negocio (`electricidad`, `agua`, `municipio`), quedando bloqueado en Neon (`configuracion.whatsapp_bot_active_target`) para que el menú y los reclamos apunten siempre al negocio elegido (p. ej. `tenant_id=1` Cooperativa Segui). También soporta `POST /api/webhooks/whatsapp/baileys/select-tenant` y `POST /api/webhooks/whatsapp/baileys/reset-session`. |
| **Whapi** | `WHATSAPP_PROVIDER=whapi` + `WHAPI_API_URL`, `WHAPI_API_KEY`, `WHATSAPP_WEBHOOK_TOKEN` (y opcional `WHAPI_CHANNEL_ID`). Webhook: `POST /api/webhooks/whatsapp/whapi`. |
| **Meta** | `WHATSAPP_PROVIDER=meta` + `META_*` (token, phone id, app secret, verify token). Webhook: `POST /api/webhooks/whatsapp/meta`. |

**Health Check en Render:** configurar **Health Check Path** en `/health` (liviano, sin golpear Neon cada 5 s). `/health/db` cuenta además con caché de 60 s (`HEALTH_DB_CACHE_MS`) para proteger Neon si sigue configurado como health check.

Plantilla local: `api/.env.example` (actualmente **`WHATSAPP_PROVIDER=whapi`**). Guía: `api/docs/CAMBIAR_PROVEEDOR_WHATSAPP.md`.

## Migración Nominatim (Vultr → Oracle)

### Cambio obligatorio

| Variable            | Valor anterior (referencia)     | Valor nuevo                          |
|--------------------|----------------------------------|--------------------------------------|
| `NOMINATIM_BASE_URL` | `http://45.76.3.146:8080` (Vultr) | `http://167.234.235.76:8080` (Oracle) |

**Sin barra final** en la URL base (la API concatena `/search`, `/reverse`, etc.).

### Variables que suelen mantenerse (revisar en el dashboard)

- `NOMINATIM_WHATSAPP_SEARCH_MODE` — p. ej. `free-form` para el pipeline WhatsApp.
- `NOMINATIM_FETCH_TIMEOUT_MS` — timeout de fetch hacia Nominatim.
- `NOMINATIM_FROM_EMAIL` / `NOMINATIM_FROM` — **recomendado** en producción (contacto OSM). Si no están definidos, la API **no** envía `From` (un `From` con dominio `.local` u opcional mal validado delante del proxy puede causar **HTTP 406**).
- `NOMINATIM_ACCEPT` — opcional; por defecto `*/*`.
- `NOMINATIM_DISABLE_406_RETRY` — si `1`, no reintenta tras 406 con cabeceras mínimas (solo diagnóstico).
- `DEBUG_NOMINATIM` — solo desarrollo; en producción suele ir vacío o `0`.
- Resto de secretos Neon, Meta, JWT, etc. **no tocar** salvo checklist de migración.

## Cómo aplicar

1. **Render Dashboard** → Service → **Environment** → editar `NOMINATIM_BASE_URL`.
2. **Save** → se dispara **redeploy** automático (o usar **Manual Deploy**).

Alternativa CLI (si tenés `render` CLI y token):

```bash
# Ejemplo conceptual — ajustar service id y sintaxis oficial de Render CLI
# render services env set <service-id> NOMINATIM_BASE_URL=http://167.234.235.76:8080
```

## Tras HTTPS en Oracle (opcional)

Cuando tengas dominio + Caddy + Let's Encrypt (ver `ORACLE_HTTPS_SETUP.md`), actualizar a:

`NOMINATIM_BASE_URL=https://nominatim.tu-dominio.com`

y volver a **Save** + redeploy.

## Rollback (contingencia)

Volver temporalmente a:

`NOMINATIM_BASE_URL=http://45.76.3.146:8080`

solo si el VPS Vultr sigue activo y accesible; luego redeploy. Ver `MIGRATION_VULTR_TO_ORACLE.md` § Plan de contingencia.

## Informes por email (API — Render)

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `EMAILJS_PUBLIC_KEY` | Sí | Public Key (ya la tenés) |
| `EMAILJS_SERVICE_ID` | Para cron/API | Mismo valor que secret GitHub `EMAILJS_SERVICE_ID` |
| `EMAILJS_TEMPLATE_ID` | Para cron/API | Mismo valor que secret GitHub `EMAILJS_TEMPLATE_ID` |

Con **solo** `EMAILJS_PUBLIC_KEY` en Render, **«Enviar ahora»** en la web admin funciona igual (usa `config.json` de Pages con las tres claves).

Plantilla EmailJS (Subject `{{email_subject}}`, Content `{{email_body}}`, To `{{to_email}}`) para informes y reset unificado.

En [EmailJS](https://www.emailjs.com/) → **Security** → permitir API desde servidor si usás envío solo por API.

---

`made by leavera77`
