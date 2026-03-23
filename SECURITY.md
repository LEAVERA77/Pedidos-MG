# Seguridad

Si en el pasado commiteaste `config.json` con la contraseña de Neon en un repositorio **público**, asumí que la credencial quedó expuesta (historial de Git). **Rotá la contraseña del usuario de base de datos** en el panel de [Neon](https://neon.tech) y actualizá el secret `NEON_CONNECTION_STRING` en GitHub.

Los secretos de producción deben vivir solo en:

- **GitHub Actions** → Secrets del repositorio (sitio web).
- **`config.json` local** ignorado por Git (Android / pruebas locales).
