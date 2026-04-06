import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("Pedidos-MG — archivos del sitio", () => {
  const required = [
    "index.html",
    "app.js",
    "sw.js",
    "styles.css",
    "map.js",
    "offline.js",
    "index.min.html",
  ];

  it.each(required)("existe %s", (file) => {
    expect(existsSync(join(root, file)), `falta ${file}`).toBe(true);
  });

  it("index.html enlaza app y tiene contenedor #app", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toMatch(/app\.js/);
    expect(html).toMatch(/id=["']app["']/);
  });

  it("sw.js declara versión de caché shell", () => {
    const sw = readFileSync(join(root, "sw.js"), "utf8");
    expect(sw).toMatch(/CACHE_SHELL/);
  });
});
