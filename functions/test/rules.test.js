"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test("Firestore rules enforce attendance ownership and server-only writes", { skip: !emulatorAvailable }, async () => {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
  const testEnv = await initializeTestEnvironment({
    projectId: "jimmore-hr-rules-test",
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") }
  });
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      const { doc, setDoc } = require("firebase/firestore");
      await setDoc(doc(firestore, "users/employee-a"), {
        role: "employee",
        isActive: true,
        department: "工程",
        managerId: "manager-a"
      });
      await setDoc(doc(firestore, "users/manager-a"), { role: "manager", isActive: true, department: "工程" });
      await setDoc(doc(firestore, "users/manager-b"), { role: "manager", isActive: true, department: "外銷" });
      await setDoc(doc(firestore, "attendance/record-a"), { userId: "employee-a", department: "工程" });
      await setDoc(doc(firestore, "leaveRequests/request-a"), {
        userId: "employee-a",
        department: "工程",
        managerId: "manager-a",
        status: "pending"
      });
    });
    const { doc, getDoc, setDoc } = require("firebase/firestore");
    const employeeDb = testEnv.authenticatedContext("employee-a").firestore();
    const ownRecord = doc(employeeDb, "attendance/record-a");
    await assertSucceeds(getDoc(ownRecord));
    await assertFails(setDoc(doc(employeeDb, "attendance/forged"), { userId: "employee-a", department: "工程" }));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext("manager-a").firestore(), "attendance/record-a")));
    await assertFails(getDoc(doc(testEnv.authenticatedContext("manager-b").firestore(), "attendance/record-a")));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext("manager-a").firestore(), "leaveRequests/request-a")));
    await assertFails(getDoc(doc(testEnv.authenticatedContext("manager-b").firestore(), "leaveRequests/request-a")));
    assert.ok(true);
  } finally {
    await testEnv.cleanup();
  }
});

test("Employee profile bootstrap cannot grant leave balance or elevated role", { skip: !emulatorAvailable }, async () => {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
  const testEnv = await initializeTestEnvironment({
    projectId: "jimmore-hr-profile-rules-test",
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") }
  });
  try {
    const { doc, setDoc, serverTimestamp } = require("firebase/firestore");
    const employeeDb = testEnv.authenticatedContext("new-employee", {
      email: "employee@example.com"
    }).firestore();
    const profileRef = doc(employeeDb, "users/new-employee");
    const safeProfile = {
      name: "新進員工",
      email: "employee@example.com",
      department: "",
      role: "employee",
      annualLeaveHours: 0,
      compensatoryLeaveHours: 0,
      isActive: true,
      workMode: "office",
      attendanceRequired: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(profileRef, safeProfile));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { deleteDoc } = require("firebase/firestore");
      await deleteDoc(doc(context.firestore(), "users/new-employee"));
    });
    await assertFails(setDoc(profileRef, { ...safeProfile, annualLeaveHours: 56 }));
    await assertFails(setDoc(profileRef, { ...safeProfile, role: "admin" }));
    await assertFails(setDoc(profileRef, { ...safeProfile, email: "other@example.com" }));
    await assertFails(setDoc(profileRef, { ...safeProfile, workMode: "unrestricted" }));
    await assertFails(setDoc(profileRef, { ...safeProfile, attendanceRequired: false }));
  } finally {
    await testEnv.cleanup();
  }
});

test("Privileged browser writes are denied even for administrators", { skip: !emulatorAvailable }, async () => {
  const { initializeTestEnvironment, assertFails } = require("@firebase/rules-unit-testing");
  const testEnv = await initializeTestEnvironment({
    projectId: "jimmore-hr-admin-rules-test",
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") }
  });
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { doc, setDoc } = require("firebase/firestore");
      const firestore = context.firestore();
      await setDoc(doc(firestore, "users/admin-a"), {
        role: "admin",
        isActive: true,
        department: "管理部"
      });
      await setDoc(doc(firestore, "users/employee-a"), {
        role: "employee",
        isActive: true,
        department: "工程"
      });
      await setDoc(doc(firestore, "leaveRequests/request-a"), {
        userId: "employee-a",
        department: "工程",
        status: "pending"
      });
      await setDoc(doc(firestore, "attendance/record-a"), {
        userId: "employee-a",
        department: "工程",
        type: "checkIn"
      });
    });
    const { deleteDoc, doc, setDoc, updateDoc } = require("firebase/firestore");
    const adminDb = testEnv.authenticatedContext("admin-a").firestore();
    await assertFails(updateDoc(doc(adminDb, "users/employee-a"), { role: "admin" }));
    await assertFails(updateDoc(doc(adminDb, "leaveRequests/request-a"), { status: "approved" }));
    await assertFails(setDoc(doc(adminDb, "workSettings/default"), { standardHours: 8 }));
    await assertFails(deleteDoc(doc(adminDb, "attendance/record-a")));
  } finally {
    await testEnv.cleanup();
  }
});

test("Authentication, active-user, request fields, manager queries, and default deny are enforced", { skip: !emulatorAvailable }, async () => {
  const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds
  } = require("@firebase/rules-unit-testing");
  const testEnv = await initializeTestEnvironment({
    projectId: "jic-workhub-boundary-rules-test",
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") }
  });
  try {
    const { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } = require("firebase/firestore");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "users/employee-a"), {
        role: "employee", isActive: true, department: "工程", managerId: "manager-a"
      });
      await setDoc(doc(firestore, "users/employee-b"), {
        role: "employee", isActive: true, department: "外銷", managerId: "manager-b"
      });
      await setDoc(doc(firestore, "users/inactive-a"), {
        role: "employee", isActive: false, department: "工程", managerId: "manager-a"
      });
      await setDoc(doc(firestore, "users/manager-a"), {
        role: "manager", isActive: true, department: "工程"
      });
      await setDoc(doc(firestore, "attendance/a"), { userId: "employee-a", department: "工程" });
      await setDoc(doc(firestore, "attendance/b"), { userId: "employee-b", department: "外銷" });
      await setDoc(doc(firestore, "attendance/inactive"), { userId: "inactive-a", department: "工程" });
      await setDoc(doc(firestore, "leaveRequests/managed"), {
        userId: "employee-a", department: "工程", managerId: "manager-a", status: "pending"
      });
      await setDoc(doc(firestore, "workSettings/default"), { standardHours: 8 });
      await setDoc(doc(firestore, "unlistedCollection/secret"), { value: true });
    });

    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymousDb, "attendance/a")));
    await assertFails(getDoc(doc(anonymousDb, "workSettings/default")));

    const inactiveDb = testEnv.authenticatedContext("inactive-a").firestore();
    await assertFails(getDoc(doc(inactiveDb, "attendance/inactive")));
    await assertFails(getDoc(doc(inactiveDb, "workSettings/default")));

    const employeeDb = testEnv.authenticatedContext("employee-a").firestore();
    await assertSucceeds(getDoc(doc(employeeDb, "attendance/a")));
    await assertFails(getDoc(doc(employeeDb, "attendance/b")));

    const leave = {
      userId: "employee-a",
      userName: "合成員工甲",
      department: "工程",
      managerId: "manager-a",
      managerName: "合成主管甲",
      proxyUserId: "",
      proxyUserName: "",
      leaveType: "annual",
      shiftId: "default",
      shiftName: "標準班",
      workStart: "09:00",
      workEnd: "18:00",
      startTime: new Date("2026-10-01T01:00:00Z"),
      endTime: new Date("2026-10-01T02:00:00Z"),
      hours: 1,
      reason: "合成測試",
      status: "pending",
      approvedBy: "",
      approvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(employeeDb, "leaveRequests/valid"), leave));
    await assertFails(setDoc(doc(employeeDb, "leaveRequests/extra-field"), { ...leave, role: "admin" }));
    await assertFails(setDoc(doc(employeeDb, "leaveRequests/preapproved"), {
      ...leave, status: "approved", approvedBy: "employee-a"
    }));

    const overtime = {
      userId: "employee-a",
      userName: "合成員工甲",
      department: "工程",
      managerId: "manager-a",
      managerName: "合成主管甲",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-01T11:00:00Z"),
      hours: 1,
      location: "合成辦公室",
      reason: "合成測試",
      convertToCompTime: true,
      status: "pending",
      approvedBy: "",
      approvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(employeeDb, "overtimeRequests/valid"), overtime));
    await assertFails(setDoc(doc(employeeDb, "overtimeRequests/forged-manager"), {
      ...overtime, managerId: "manager-b"
    }));

    const managerDb = testEnv.authenticatedContext("manager-a").firestore();
    await assertSucceeds(getDocs(query(
      collection(managerDb, "leaveRequests"),
      where("managerId", "==", "manager-a")
    )));
    await assertFails(getDoc(doc(employeeDb, "unlistedCollection/secret")));
    await assertFails(setDoc(doc(employeeDb, "unlistedCollection/new"), { value: true }));
  } finally {
    await testEnv.cleanup();
  }
});
