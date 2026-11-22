# Seguridad

`DATABASE_URL` (cadena de conexión a PostgreSQL / Neon) vive **exclusivamente en el servidor backend (Render)** y **nunca** debe incluirse en `config.json` ni publicarse en GitHub Pages.

- **Frontend (`config.json` en GitHub Pages / Android):** solo contiene `api.baseUrl` y las claves públicas de EmailJS (`publicKey`, `serviceId`, `templateId`). Todas las operaciones de datos se autentican con JWT contra la API en Render (`/api/*` y `/api/sql/query`).
- **Backend (`api/` en Render):** almacena `DATABASE_URL`, `JWT_SECRET` y tokens de proveedores en variables de entorno privadas del servidor.
- **Rotación de credenciales:** si alguna vez `NEON_CONNECTION_STRING` estuvo expuesta en artefactos estáticos o historial, regenerá la contraseña del rol en el panel de [Neon](https://neon.tech) (**Roles & Databases → Reset password**), actualizá `DATABASE_URL` en Render y eliminá el secret `NEON_CONNECTION_STRING` de GitHub Actions.
