const LEGACY_PROJECT_ID = ["jimmore", "workhub"].join("-");
const REQUIRED_FIREBASE_VALUES = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

export function assertBuildEnvironment(mode, env) {
  if (!new Set(["staging", "production"]).has(mode)) {
    throw new Error(`Unsupported Vite mode: ${mode}.`);
  }
  const missing = REQUIRED_FIREBASE_VALUES.filter((name) => !String(env[name] || "").trim());
  if (missing.length) throw new Error(`${mode} build is missing: ${missing.join(", ")}`);
  if (env.VITE_APP_ENV !== mode) {
    throw new Error(`VITE_APP_ENV must match Vite mode: expected ${mode}.`);
  }

  const projectId = String(env.VITE_FIREBASE_PROJECT_ID).trim();
  const normalizedProjectId = projectId.toLowerCase();
  if (projectId === LEGACY_PROJECT_ID) {
    throw new Error("Company builds cannot use the legacy Firebase project.");
  }
  if (mode === "staging"
    && !normalizedProjectId.startsWith("demo-")
    && !normalizedProjectId.includes("staging")) {
    throw new Error("Staging builds require an approved staging or demo Project ID.");
  }
  if (mode === "production") {
    if (!env.VITE_APP_CHECK_SITE_KEY) {
      throw new Error("Production build is missing VITE_APP_CHECK_SITE_KEY.");
    }
    if (normalizedProjectId.startsWith("demo-") || normalizedProjectId.includes("staging")) {
      throw new Error("Production build cannot use a demo or staging Project ID.");
    }
    if (env.VITE_USE_FIREBASE_EMULATORS === "true") {
      throw new Error("Production build cannot enable Firebase emulators.");
    }
  }
  return Object.freeze({ environment: mode, projectId });
}
