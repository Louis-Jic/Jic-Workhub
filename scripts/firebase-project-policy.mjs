const LEGACY_PROJECT_ID = ["jimmore", "workhub"].join("-");

export function approvedProjectsFrom(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function assertApprovedFirebaseProject({
  projectId,
  environment,
  confirmation,
  approvedProjectIds
}) {
  const id = String(projectId || "").trim();
  const targetEnvironment = String(environment || "").trim();
  const approved = new Set(approvedProjectIds || []);

  if (!id) throw new Error("Firebase deployment requires an explicit Project ID.");
  if (!new Set(["staging", "production"]).has(targetEnvironment)) {
    throw new Error("Firebase deployment requires an explicit staging or production environment.");
  }
  if (id === LEGACY_PROJECT_ID) {
    throw new Error("This company repository cannot deploy to the legacy Firebase project.");
  }
  if (id.startsWith("demo-")) throw new Error("Demo Project IDs cannot be deployment targets.");
  if (confirmation !== id) throw new Error("Project confirmation must exactly match the target Project ID.");
  if (!approved.size || !approved.has(id)) {
    throw new Error("Target Project ID is not present in JIC_APPROVED_FIREBASE_PROJECTS.");
  }
  if (targetEnvironment === "staging" && !id.toLowerCase().includes("staging")) {
    throw new Error("Staging deployments require a Project ID containing staging.");
  }
  if (targetEnvironment === "production" && id.toLowerCase().includes("staging")) {
    throw new Error("Production deployments cannot target a staging Project ID.");
  }
  return Object.freeze({ projectId: id, environment: targetEnvironment });
}
