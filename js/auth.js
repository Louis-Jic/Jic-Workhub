import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, qs, showToast } from "./app.js";

const loginForm = qs("#loginForm");
const loginPassword = qs("#loginPassword");
const loginPasswordToggle = qs("#loginPasswordToggle");

loginPasswordToggle?.addEventListener("click", () => {
  const shouldShow = loginPassword.type === "password";
  loginPassword.type = shouldShow ? "text" : "password";
  loginPasswordToggle.setAttribute("aria-pressed", String(shouldShow));
  loginPasswordToggle.setAttribute("aria-label", shouldShow ? "隱藏密碼" : "顯示密碼");
  loginPasswordToggle.title = shouldShow ? "隱藏密碼" : "顯示密碼";
  loginPasswordToggle.querySelector('[data-password-icon="show"]')?.classList.toggle("d-none", shouldShow);
  loginPasswordToggle.querySelector('[data-password-icon="hide"]')?.classList.toggle("d-none", !shouldShow);
  loginPassword.focus();
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = qs("#loginEmail").value.trim();
  const password = qs("#loginPassword").value;
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userSnap = await getDoc(doc(db, "users", credential.user.uid));
    const role = userSnap.exists() ? userSnap.data().role : "employee";
    location.href = role === "admin" ? "admin/index.html" : "dashboard.html";
  } catch (error) {
    showToast(`登入失敗：${error.message}`, "danger");
  }
});
