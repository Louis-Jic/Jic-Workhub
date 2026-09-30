import { spawnSync } from "node:child_process";
import {
  approvedProjectsFrom,
  assertApprovedFirebaseProject
} from "./firebase-project-policy.mjs";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}
const positional = args.filter((value) => value !== "--execute" && !value.startsWith("--"));

const result = assertApprovedFirebaseProject({
  projectId: option("--project") || positional[0],
  environment: option("--environment") || positional[1],
  confirmation: option("--confirm-project") || positional[2],
  approvedProjectIds: approvedProjectsFrom(process.env.JIC_APPROVED_FIREBASE_PROJECTS)
});

if (!execute) {
  console.log(`Deployment guard approved ${result.environment} project ${result.projectId}; validation only, nothing deployed.`);
  process.exit(0);
}

const only = option("--only") || positional[3];
if (!only) throw new Error("Deployment execution requires an explicit --only resource list.");

const command = process.platform === "win32" ? "firebase.cmd" : "firebase";
const child = spawnSync(command, ["deploy", "--project", result.projectId, "--only", only], {
  stdio: "inherit",
  env: {
    ...process.env,
    JIC_DEPLOY_ENV: result.environment,
    JIC_DEPLOY_CONFIRM_PROJECT: result.projectId
  }
});
if (child.error) throw child.error;
process.exit(child.status ?? 1);
