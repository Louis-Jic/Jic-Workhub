import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const projectId = "demo-jic-workhub-staging";

function javaExecutable(javaHome) {
  return join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
}

function systemJavaWorks() {
  const result = spawnSync("java", ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

function portableJavaHome() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return "";

  const root = join(localAppData, "JicWorkhubTools", "jdk21");
  if (!existsSync(root)) return "";

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"))
    .map((entry) => join(root, entry.name))
    .find((candidate) => existsSync(javaExecutable(candidate))) || "";
}

const environment = { ...process.env };
if (!systemJavaWorks()) {
  const javaHome = portableJavaHome();
  if (!javaHome) {
    console.error("找不到 Java 21。請安裝 Java 21，或將可攜版放在 LocalAppData/JicWorkhubTools/jdk21。");
    process.exit(1);
  }
  environment.JAVA_HOME = javaHome;
  environment.PATH = `${join(javaHome, "bin")}${process.platform === "win32" ? ";" : ":"}${environment.PATH || ""}`;
}

const firebaseCli = join(process.cwd(), "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const child = spawn(process.execPath, [
  firebaseCli,
  "emulators:start",
  "--project", projectId,
  "--only", "auth,firestore,functions"
], {
  env: environment,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error("Firebase Emulator 啟動失敗：", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
