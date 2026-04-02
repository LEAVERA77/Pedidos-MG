# Pedidos MG (GitHub Pages)

Aplicación web para gestión de pedidos de mantenimiento.  
**Sitio:** [leavera77.github.io/Pedidos-MG](https://leavera77.github.io/Pedidos-MG/)

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

## Seguridad

Si alguna vez subiste credenciales al repo público, leé [SECURITY.md](./SECURITY.md).

## Paridad con la app Android

La fuente de verdad del front suele ser `PedidosMG/app/src/main/assets/` (Android Studio). Tras cambios grandes, copiá `index.html` y `sw.js` a este repo y subí commit (el `config.json` del APK no se sube aquí: usá secretos + Actions).

## WhatsApp Cloud API (Meta)

El bot y el webhook de Meta se configuran **solo en el servidor de la API** (variables de entorno), no en este repo ni en `config.json`. En el panel de Meta, la URL del webhook debe ser:

`https://<tu-API>/api/webhooks/whatsapp/meta`

(con el mismo *Verify token* que definas en el backend). Detalle de variables: repositorio Android/Nexxo, archivo `api/.env.example`.

## API y consumo Neon (Android + Web/PWA)

La app Android y esta Web/PWA consumen la misma API. Para evitar consumo innecesario de `network transfer` en Neon:

- Usar `GET /health` para monitoreo liviano (no consulta base de datos).
- Usar `GET /health/db` solo para diagnóstico manual (sí consulta Neon).
- No usar `/api/app-version` como endpoint de uptime.
- Si necesitás el mínimo consumo posible, pausar cron/monitores y despertar solo con tráfico real de usuarios.
