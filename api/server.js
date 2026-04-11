import "dotenv/config";
import { createHttpApp } from "./httpApp.js";

const PORT = Number(process.env.PORT || 3000);
const app = createHttpApp();

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: "info",
      ts: new Date().toISOString(),
      msg: "api_listening",
      port: PORT,
      service: "pedidosmg-api",
      version: "2.0.1-coords-migration"
    })
  );
});

// Deploy marker: 2026-04-11 01:15 - Columnas latitud/longitud agregadas a socios_catalogo
