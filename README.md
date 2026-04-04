# Pedidos MG (GitHub Pages)

Aplicación web para gestión de pedidos de mantenimiento.  
**Sitio:** [leavera77.github.io/Pedidos-MG](https://leavera77.github.io/Pedidos-MG/)

### Política de privacidad (Meta / WhatsApp / tiendas)

El texto en **español (Argentina)** está en `privacy/index.html` y se publica con el mismo workflow de Pages.

- **URL tras deploy (este repo):** [leavera77.github.io/Pedidos-MG/privacy/](https://leavera77.github.io/Pedidos-MG/privacy/) — podés usarla en Meta Developers y en Google Play como política de privacidad.
- Si necesitás la ruta **sin** el nombre del proyecto (`https://leavera77.github.io/privacy/`), creá un repositorio público GitHub llamado **`privacy`**, subí el mismo `index.html` a la **raíz** del repo (como `index.html`), en **Settings → Pages** elegí **Deploy from branch** `main` y `/ (root)`. El sitio quedará en `https://leavera77.github.io/privacy/`.

## Derechos de autor

Ver [COPYRIGHT.md](./COPYRIGHT.md).

## Configuración sin subir secretos

El archivo **`config.json`** está en `.gitignore` y **no debe commitearse**. En el repositorio solo hay **`config.example.json`** como plantilla.

### Desarrollo local

```bash
cp config.example.json config.json
# Editá config.json con tu cadena Neon y (opcional) EmailJS
```

### Producción (GitHub Pages)

1. En el repo: **Settings → Secrets and variables → Actions**, creá:

   | Secret | Descripción |
   |--------|-------------|
   | `NEON_CONNECTION_STRING` | URI completa `postgresql://...` (obligatorio) |
   | `API_BASE_URL` | URL pública de la API Node/Render (obligatorio para setup wizard SaaS), p. ej. `https://tu-servicio.onrender.com` |
   | `EMAILJS_PUBLIC_KEY` | Opcional |
   | `EMAILJS_SERVICE_ID` | Opcional |
   | `EMAILJS_TEMPLATE_ID` | Opcional |

2. **Settings → Pages → Build and deployment → Source:** elegí **GitHub Actions** (no “Deploy from branch”).

3. Cada push a `main` ejecuta el workflow que genera `config.json` en el artefacto y publica el sitio.

### Cómo publicar los cambios del front (implementación en GitHub)

1. Subí a `main` el front modular: `index.html`, `styles.css`, `app.js`, `map.js`, `offline.js` y `sw.js` (commit + `git push origin main`). El workflow de Pages copia esos archivos al sitio publicado.
2. Esperá a que termine el workflow **Deploy GitHub Pages** en la pestaña **Actions**, o disparalo a mano: **Actions → Deploy GitHub Pages → Run workflow** en la rama `main`.
3. La API en Render debe estar actualizada si cambió el backend: commit/push en **`api/`** de este repo y **Manual Deploy** en Render (o el auto-deploy que tengas configurado).
4. **Setup inicial (admin):** la primera vez, el administrador debe completar el asistente en la app; el estado queda guardado en Neon (`clientes.configuracion.setup_wizard_completado`). Para saltearlo en un tenant ya existente (solo BD):  
   `UPDATE clientes SET configuracion = COALESCE(configuracion,'{}'::jsonb) || '{"setup_wizard_completado": true}'::jsonb WHERE id = <tenant_id>;`

## Seguridad

Si alguna vez subiste credenciales al repo público, leé [SECURITY.md](./SECURITY.md).

## Paridad con la app Android

La fuente de verdad del front suele ser `Nexxo/app/src/main/assets/` (Android Studio). Tras cambios grandes, copiá `index.html`, `styles.css`, `app.js`, `map.js`, `offline.js` y `sw.js` a este repo y subí commit (el `config.json` del APK no se sube aquí: usá secretos + Actions).

## API Node (carpeta `api/` en este repo)

El **código fuente del backend** (Express, webhooks Meta/WhatsApp, Neon) está en **`/api`** de este mismo repositorio [LEAVERA77/Pedidos-MG](https://github.com/LEAVERA77/Pedidos-MG). Desarrollo local:

```bash
cd api
npm ci
cp .env.example .env
# Completá .env (DATABASE_URL, META_*, etc.) y: npm run dev
```

En Render (u otro host), el *Root Directory* puede apuntar a `api` o desplegás desde la raíz según tu `package.json` de servicio. Mantener **paridad**: tras cambios en `Nexxo/api`, sincronizá archivos hacia `Pedidos-MG/api` y subí commit + push a `main`.

## WhatsApp Cloud API (Meta)

El bot y el webhook de Meta se configuran en el **servidor** (variables de entorno), no en `config.json` de Pages. En el panel de Meta, la URL del webhook debe ser:

`https://<tu-API>/api/webhooks/whatsapp/meta`

(con el mismo *Verify token* que definas en el backend). Variables de ejemplo: **`api/.env.example`** en este repo.

**Varios municipios / números de WhatsApp:** en Neon, cada fila de `clientes` puede llevar en `configuracion` la clave `meta_phone_id` o `meta_phone_number_id` (Phone number ID de Meta) y `meta_access_token`, para que el mismo servidor en Render enrute y responda con el tenant correcto.

## API y consumo Neon (Android + Web/PWA)

La app Android y esta Web/PWA consumen la misma API. Para evitar consumo innecesario de `network transfer` en Neon:

- Usar `GET /health` para monitoreo liviano (no consulta base de datos).
- Usar `GET /health/db` solo para diagnóstico manual (sí consulta Neon).
- No usar `/api/app-version` como endpoint de uptime.
- Si necesitás el mínimo consumo posible, pausar cron/monitores y despertar solo con tráfico real de usuarios.
