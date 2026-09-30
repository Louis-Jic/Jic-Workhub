import {
  approvedProjectsFrom,
  assertApprovedFirebaseProject
} from "./firebase-project-policy.mjs";

const result = assertApprovedFirebaseProject({
  projectId: process.env.GCLOUD_PROJECT,
  environment: process.env.JIC_DEPLOY_ENV,
  confirmation: process.env.JIC_DEPLOY_CONFIRM_PROJECT,
  approvedProjectIds: approvedProjectsFrom(process.env.JIC_APPROVED_FIREBASE_PROJECTS)
});

console.log(`Predeploy guard approved ${result.environment} project ${result.projectId}.`);
