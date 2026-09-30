import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedProjectsFrom,
  assertApprovedFirebaseProject
} from "../scripts/firebase-project-policy.mjs";

const approved = ["jic-workhub-staging", "jic-workhub-production"];

test("deployment policy accepts an explicitly approved and confirmed staging project", () => {
  assert.deepEqual(assertApprovedFirebaseProject({
    projectId: "jic-workhub-staging",
    environment: "staging",
    confirmation: "jic-workhub-staging",
    approvedProjectIds: approved
  }), { projectId: "jic-workhub-staging", environment: "staging" });
});

test("deployment policy rejects blank, legacy, demo, unapproved, and unconfirmed targets", () => {
  const base = { environment: "staging", confirmation: "jic-workhub-staging", approvedProjectIds: approved };
  assert.throws(() => assertApprovedFirebaseProject({ ...base, projectId: "" }), /explicit Project ID/);
  assert.throws(() => assertApprovedFirebaseProject({ ...base, projectId: ["jimmore", "workhub"].join("-") }), /legacy/);
  assert.throws(() => assertApprovedFirebaseProject({ ...base, projectId: "demo-jic-workhub-staging" }), /Demo/);
  assert.throws(() => assertApprovedFirebaseProject({ ...base, projectId: "other-staging", confirmation: "other-staging" }), /not present/);
  assert.throws(() => assertApprovedFirebaseProject({ ...base, projectId: "jic-workhub-staging", confirmation: "wrong" }), /exactly match/);
});

test("deployment policy prevents staging and production environment crossover", () => {
  assert.throws(() => assertApprovedFirebaseProject({
    projectId: "jic-workhub-production",
    environment: "staging",
    confirmation: "jic-workhub-production",
    approvedProjectIds: approved
  }), /containing staging/);
  assert.throws(() => assertApprovedFirebaseProject({
    projectId: "jic-workhub-staging",
    environment: "production",
    confirmation: "jic-workhub-staging",
    approvedProjectIds: approved
  }), /cannot target a staging/);
});

test("approved project environment variable parsing removes blanks", () => {
  assert.deepEqual(approvedProjectsFrom(" alpha, ,beta "), ["alpha", "beta"]);
});
