import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { assertBuildEnvironment } from "./scripts/build-environment-policy.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const htmlEntries = Object.fromEntries([
  ...readdirSync(root)
    .filter((name) => name.endsWith(".html"))
    .map((name) => [name.replace(/\.html$/, ""), resolve(root, name)]),
  ...readdirSync(resolve(root, "admin"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => [`admin-${name.replace(/\.html$/, "")}`, resolve(root, "admin", name)])
]);

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, root, "VITE_"), ...process.env };
  assertBuildEnvironment(mode, env);

  return {
    root,
    publicDir: false,
    define: {
      __FIREBASE_PROJECT_APPROVED__: "true"
    },
    plugins: mode === "production" ? [{
      name: "production-cname",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "CNAME", source: "workhub.jimmore.com.tw\n" });
      }
    }] : [],
    build: {
      outDir: resolve(root, "dist", mode),
      emptyOutDir: false,
      sourcemap: false,
      rollupOptions: {
        input: htmlEntries
      }
    }
  };
});
