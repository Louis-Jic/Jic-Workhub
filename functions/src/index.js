"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { createSecurityRuntime } = require("./lib/security-runtime");
const { createAdminHandlers } = require("./lib/admin-service");
const { recentDates, selectMissingAttendanceCandidates, validCheckoutCorrectionTime } = require("./lib/missing-attendance");
const {
  canPunchOutsideWindow,
  calculateWorkHours,
  decideLocation,
  effectiveWorkEnd,
  earliestCheckInsByUserDate,
  isRestDay,
  taipeiDateTime,
  todayKeyTaipei,
  workingMinutesBetween
} = require("./core");

initializeApp();
const db = getFirestore();
const {
  audit,
  callable,
  cleanText,
  profileFor,
  requireAdmin,
  requireReviewer,
  timestampDate
} = createSecurityRuntime(db);
const adminHandlers = createAdminHandlers({
  db,
  audit,
  cleanText,
  profileFor,
  requireAdmin,
  requireReviewer,
  rebuildAttendanceDaily,
  rebuildPunchGuard
});

exports.createEmployeeAccount = callable(adminHandlers.createEmployeeAccount);
exports.updateEmployee = callable(adminHandlers.updateEmployee);
exports.reviewHrRequest = callable(adminHandlers.reviewHrRequest);
exports.recalculateOvertimeRequest = callable(adminHandlers.recalculateOvertimeRequest);
exports.voidApprovedLeave = callable(adminHandlers.voidApprovedLeave);
exports.saveWorkSettings = callable(adminHandlers.saveWorkSettings);
exports.getAnnualCalendar = callable(adminHandlers.getAnnualCalendar);
exports.saveAnnualCalendar = callable(adminHandlers.saveAnnualCalendar);
exports.saveCompanyEvent = callable(adminHandlers.saveCompanyEvent);
exports.deleteCompanyEvent = callable(adminHandlers.deleteCompanyEvent);
exports.deleteAttendanceRecord = callable(adminHandlers.deleteAttendanceRecord);

exports.getEmployeeDirectory = callable(async function getEmployeeDirectory(request) {
  const viewer = await profileFor(request.auth.uid);
  const users = await db.collection("users").get();
  const employees = users.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((employee) => employee.isActive !== false && employee.id !== viewer.id)
    .filter((employee) => !viewer.department || employee.department === viewer.department)
    .map((employee) => ({
      id: employee.id,
      name: cleanText(employee.name, 100),
      department: cleanText(employee.department, 100)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return { employees };
});

exports.getCompanyEvents = callable(async function getCompanyEvents(request) {
  const admin = await profileFor(request.auth.uid);
  requireAdmin(admin);
  const requestedYear = cleanText(request.data?.year, 4);
  const year = /^\d{4}$/.test(requestedYear) ? requestedYear : "";
  const yearStart = year ? `${year}-01-01` : "";
  const yearEnd = year ? `${year}-12-31` : "";
  const snap = await db.collection("companyEvents").get();
  return {
    companyEvents: snap.docs
      .map(publicCompanyEvent)
      .filter((event) => event.title && event.startDate && event.endDate)
      .filter((event) => !year || (event.startDate <= yearEnd && event.endDate >= yearStart))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, "zh-Hant"))
  };
});

exports.getTeamCalendar = callable(async function getTeamCalendar(request) {
  await profileFor(request.auth.uid);
  const [leaveSnap, attendanceSnap, settingsSnap, companyEventSnap, annualCalendarSnap] = await Promise.all([
    db.collection("leaveRequests").where("status", "==", "approved").get(),
    db.collection("attendance").where("type", "==", "checkIn").get(),
    db.doc("workSettings/default").get(),
    db.collection("companyEvents").get(),
    db.collection("calendarYears").get()
  ]);
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const toIso = (value) => {
    const date = timestampDate(value);
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  };
  const leaves = leaveSnap.docs
    .map((docSnap) => docSnap.data())
    .map((leave) => ({
      userId: cleanText(leave.userId, 128),
      userName: cleanText(leave.userName, 100),
      department: cleanText(leave.department, 100),
      leaveType: cleanText(leave.leaveType, 50),
      startTime: toIso(leave.startTime),
      endTime: toIso(leave.endTime),
      hours: Math.max(0, Number(leave.hours) || 0)
    }))
    .filter((leave) => leave.startTime && leave.endTime);
  const lateRecords = earliestCheckInsByUserDate(attendanceSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    .map((record) => ({
      id: cleanText(record.id, 128),
      userId: cleanText(record.userId, 128),
      userName: cleanText(record.userName, 100),
      department: cleanText(record.department, 100),
      date: cleanText(record.date, 10),
      shiftName: cleanText(record.shiftName, 100),
      workStart: cleanText(record.workStart, 5),
      timestamp: toIso(record.timestamp),
      lateGraceMinutes: Number.isFinite(Number(record.lateGraceMinutes))
        ? Number(record.lateGraceMinutes)
        : Number(settings.lateGraceMinutes || 0),
      graceSource: Number.isFinite(Number(record.lateGraceMinutes)) ? "record" : "current_settings",
      source: cleanText(record.source, 80),
      locationDecision: cleanText(record.locationDecision, 80),
      manualCorrection: record.manualCorrection === true,
      correctionReason: cleanText(record.correctionReason, 500),
      correctedByName: cleanText(record.correctedByName, 100)
    }))
    .filter((record) => record.timestamp);
  const companyEvents = companyEventSnap.docs
    .map(publicCompanyEvent)
    .filter((event) => event.isActive !== false)
    .filter((event) => event.title && /^\d{4}-\d{2}-\d{2}$/.test(event.startDate)
      && /^\d{4}-\d{2}-\d{2}$/.test(event.endDate));
  const calendarDays = annualCalendarSnap.docs
    .flatMap((docSnap) => Array.isArray(docSnap.data()?.days) ? docSnap.data().days : [])
    .map((item) => ({
      date: cleanText(item?.date, 10),
      name: cleanText(item?.name, 120),
      type: cleanText(item?.type, 30)
    }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
    .filter((item) => ["holiday", "company_rest", "makeup_workday"].includes(item.type));
  return {
    leaves,
    lateRecords,
    companyEvents,
    workCalendar: {
      days: calendarDays,
      restDays: (Array.isArray(settings.holidayDates) ? settings.holidayDates : [])
        .map((date) => cleanText(date, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
      makeupWorkDays: (Array.isArray(settings.makeupWorkDates) ? settings.makeupWorkDates : [])
        .map((date) => cleanText(date, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    },
    attendanceSettings: {
      lateGraceMinutes: Number(settings.lateGraceMinutes || 0),
      lunchStart: cleanText(settings.lunchStart, 5) || "12:00",
      lunchEnd: cleanText(settings.lunchEnd, 5) || "13:00"
    }
  };
}, { enforceAppCheck: false });

function publicCompanyEvent(docSnap) {
  const event = docSnap.data();
  return {
    id: cleanText(docSnap.id, 128),
    title: cleanText(event.title, 120),
    category: cleanText(event.category, 40),
    startDate: cleanText(event.startDate, 10),
    endDate: cleanText(event.endDate, 10),
    allDay: event.allDay !== false,
    startTime: cleanText(event.startTime, 5),
    endTime: cleanText(event.endTime, 5),
    description: cleanText(event.description, 1000),
    isActive: event.isActive !== false
  };
}

function normalizedShift(profile, settings) {
  const shifts = Array.isArray(settings.workShifts) ? settings.workShifts : [];
  return shifts.find((item) => item.id === profile.defaultShiftId)
    || shifts[0]
    || { id: "default", name: "日班 09:00", workStart: settings.workStart || "09:00", workEnd: settings.workEnd || "18:00" };
}

async function activeFieldAssignments(userId, now) {
  const snap = await db.collection("fieldAssignments").where("userId", "==", userId).get();
  return snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => {
    const start = timestampDate(item.startAt);
    const end = timestampDate(item.endAt);
    return item.active !== false && start && end && start <= now && end >= now;
  });
}

async function currentLocationDecision(employee, now, location) {
  if (employee.workMode === "field") {
    return decideLocation(location, [], [], { unrestricted: true, maxAccuracyM: 150 });
  }
  const [siteSnap, assignments] = await Promise.all([
    db.collection("workSites").where("active", "==", true).get(),
    activeFieldAssignments(employee.id, now)
  ]);
  return decideLocation(location,
    siteSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    assignments);
}

function assertPunchWindow(now, date, shift, settings) {
  const minutes = Number(settings.punchWindowMinutes || 13);
  const openAt = new Date(taipeiDateTime(date, shift.workStart).getTime() - minutes * 60000);
  const closeAt = new Date(taipeiDateTime(date, effectiveWorkEnd(date, shift, settings)).getTime() + minutes * 60000);
  if (now < openAt || now > closeAt) throw new HttpsError("failed-precondition", "目前不在允許的打卡時段內。");
}

async function recordsForDate(userId, date) {
  const snap = await db.collection("attendance")
    .where("userId", "==", userId).where("date", "==", date).get();
  return snap.docs.map((item) => ({ id: item.id, ...item.data(), timestamp: timestampDate(item.data().timestamp) }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function validatePunchSequence(type, rows) {
  const last = rows.at(-1);
  if (type === "checkIn" && last?.type === "checkIn") throw new HttpsError("already-exists", "目前已有未簽退的簽到紀錄。");
  if (type === "checkOut" && (!last || last.type !== "checkIn")) throw new HttpsError("failed-precondition", "必須先完成簽到才能簽退。");
}

async function approvedLeavesForDate(userId, date) {
  const snap = await db.collection("leaveRequests").where("userId", "==", userId).get();
  const dayStart = taipeiDateTime(date, "00:00");
  const dayEnd = taipeiDateTime(date, "23:59");
  return snap.docs.map((item) => item.data()).filter((leave) => leave.status === "approved"
    && timestampDate(leave.startTime) <= dayEnd && timestampDate(leave.endTime) >= dayStart);
}

function overlapMinutes(start, end, blockStart, blockEnd) {
  return Math.max(0, (Math.min(end.getTime(), blockEnd.getTime()) - Math.max(start.getTime(), blockStart.getTime())) / 60000);
}

function leaveCoverageMinutes(start, end, leaveRows, date, settings) {
  if (end <= start) return 0;
  const lunchStart = taipeiDateTime(date, settings.lunchStart || "12:00");
  const lunchEnd = taipeiDateTime(date, settings.lunchEnd || "13:00");
  return leaveRows.reduce((sum, leave) => {
    const leaveStart = timestampDate(leave.startTime);
    const leaveEnd = timestampDate(leave.endTime);
    const gross = overlapMinutes(start, end, leaveStart, leaveEnd);
    const lunch = overlapMinutes(
      new Date(Math.max(start.getTime(), lunchStart.getTime())),
      new Date(Math.min(end.getTime(), lunchEnd.getTime())),
      leaveStart,
      leaveEnd
    );
    return sum + Math.max(0, gross - lunch);
  }, 0);
}

function scheduledHours(date, shift, settings) {
  const start = taipeiDateTime(date, shift.workStart);
  const end = taipeiDateTime(date, effectiveWorkEnd(date, shift, settings));
  const lunchStart = taipeiDateTime(date, settings.lunchStart || "12:00");
  const lunchEnd = taipeiDateTime(date, settings.lunchEnd || "13:00");
  const gross = (end.getTime() - start.getTime()) / 60000;
  return Number(((gross - overlapMinutes(start, end, lunchStart, lunchEnd)) / 60).toFixed(2));
}

function resolveStatusWithLeaves(type, at, date, shift, settings, leaveRows) {
  const lunchStart = taipeiDateTime(date, settings.lunchStart || "12:00");
  const lunchEnd = taipeiDateTime(date, settings.lunchEnd || "13:00");
  if (type === "checkIn") {
    const start = taipeiDateTime(date, shift.workStart);
    const lateMinutes = workingMinutesBetween(start, at, lunchStart, lunchEnd)
      - Number(settings.lateGraceMinutes || 0)
      - leaveCoverageMinutes(start, at, leaveRows, date, settings);
    return lateMinutes > 0 ? "late" : "normal";
  }
  const end = taipeiDateTime(date, effectiveWorkEnd(date, shift, settings));
  const earlyMinutes = workingMinutesBetween(at, end, lunchStart, lunchEnd)
    - leaveCoverageMinutes(at, end, leaveRows, date, settings);
  return earlyMinutes > 0 ? "earlyLeave" : "normal";
}

async function rebuildAttendanceDaily(employee, date, settings) {
  const [rows, approvedLeaves] = await Promise.all([
    recordsForDate(employee.id, date),
    approvedLeavesForDate(employee.id, date)
  ]);
  const firstIn = rows.find((row) => row.type === "checkIn");
  const lastOut = [...rows].reverse().find((row) => row.type === "checkOut");
  const shift = normalizedShift(employee, settings);
  const hours = calculateWorkHours(rows, date, settings);
  const expectedHours = scheduledHours(date, shift, settings);
  const creditedLeaveHours = Number((leaveCoverageMinutes(
    taipeiDateTime(date, shift.workStart),
    taipeiDateTime(date, effectiveWorkEnd(date, shift, settings)),
    approvedLeaves,
    date,
    settings
  ) / 60).toFixed(2));
  let status = "incomplete";
  if (!firstIn && !lastOut) status = "missing";
  else if (firstIn && lastOut) {
    const checkInStatus = resolveStatusWithLeaves("checkIn", firstIn.timestamp, date, shift, settings, approvedLeaves);
    const checkOutStatus = resolveStatusWithLeaves("checkOut", lastOut.timestamp, date, shift, settings, approvedLeaves);
    status = checkInStatus === "late" ? "late"
      : checkOutStatus === "earlyLeave" ? "earlyLeave"
        : hours + creditedLeaveHours >= expectedHours ? "normal" : "workTimeNotEnough";
  }
  await db.doc(`attendanceDaily/${date}_${employee.id}`).set({
    userId: employee.id,
    userName: employee.name || employee.email || "",
    department: employee.department || "",
    date,
    shiftId: shift.id,
    shiftName: shift.name,
    workStart: shift.workStart,
    workEnd: shift.workEnd,
    effectiveWorkEnd: effectiveWorkEnd(date, shift, settings),
    checkInTime: firstIn ? Timestamp.fromDate(firstIn.timestamp) : null,
    checkOutTime: lastOut ? Timestamp.fromDate(lastOut.timestamp) : null,
    totalWorkHours: hours,
    creditedLeaveHours,
    expectedHours,
    status,
    isEightHoursReached: hours + creditedLeaveHours >= expectedHours,
    hasManualCorrection: rows.some((row) => row.manualCorrection),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function rebuildPunchGuard(userId, date) {
  const rows = await recordsForDate(userId, date);
  const guardRef = db.doc(`punchGuards/${date}_${userId}`);
  const last = rows.at(-1);
  if (!last) {
    await guardRef.delete();
    return;
  }
  await guardRef.set({
    userId,
    date,
    lastType: last.type,
    updatedAt: Timestamp.fromDate(last.timestamp)
  });
}

exports.punch = callable(async function punch(request) {
  const employee = await profileFor(request.auth.uid);
  if (employee.attendanceRequired === false) {
    throw new HttpsError("failed-precondition", "此帳號已設定為免打卡人員。");
  }
  const type = request.data?.type;
  if (!["checkIn", "checkOut"].includes(type)) {
    throw new HttpsError("invalid-argument", "打卡類型錯誤。");
  }

  const now = new Date();
  const date = todayKeyTaipei(now);
  const settingsSnap = await db.doc("workSettings/default").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const shift = normalizedShift(employee, settings);
  if (!canPunchOutsideWindow(employee)) {
    assertPunchWindow(now, date, shift, settings);
  }
  const rows = await recordsForDate(employee.id, date);
  validatePunchSequence(type, rows);
  const locationDecision = await currentLocationDecision(employee, now, request.data?.location);
  if (!locationDecision.allowed) {
    throw new HttpsError("permission-denied", locationDecision.reason === "gps_accuracy_too_low"
      ? "定位精度不足，請移至可接收 GPS 的位置後重試。" : "目前位置不在公司據點或核准外勤範圍內。");
  }
  const approvedLeaves = await approvedLeavesForDate(employee.id, date);
  const hasEarlierCheckIn = type === "checkIn"
    && rows.some((row) => row.type === "checkIn" && timestampDate(row.timestamp) <= now);
  const status = hasEarlierCheckIn
    ? "normal"
    : resolveStatusWithLeaves(type, now, date, shift, settings, approvedLeaves);
  const exceptionRef = db.doc(`attendanceExceptions/${date}_${employee.id}${type === "checkOut" ? "_checkOut" : ""}`);
  let exceptionSnap = await exceptionRef.get();
  if (!exceptionSnap.exists && type === "checkOut") {
    const legacyRef = db.doc(`attendanceExceptions/${date}_${employee.id}`);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) {
      exceptionSnap = legacySnap;
    }
  }
  const recordRef = db.collection("attendance").doc();
  const guardRef = db.doc(`punchGuards/${date}_${employee.id}`);
  await db.runTransaction(async (transaction) => {
    const guard = await transaction.get(guardRef);
    if (guard.exists && guard.data().lastType === type
      && Date.now() - timestampDate(guard.data().updatedAt).getTime() < 60_000) {
      throw new HttpsError("already-exists", "重複打卡已被阻擋。");
    }
    transaction.create(recordRef, {
      userId: employee.id,
      userName: employee.name || employee.email || "",
      department: employee.department || "",
      type,
      shiftId: shift.id,
      shiftName: shift.name,
      workStart: shift.workStart,
      workEnd: shift.workEnd,
      lateGraceMinutes: Number(settings.lateGraceMinutes || 0),
      timestamp: Timestamp.fromDate(now),
      serverReceivedAt: FieldValue.serverTimestamp(),
      date,
      latitude: locationDecision.location.latitude,
      longitude: locationDecision.location.longitude,
      gpsAccuracyM: locationDecision.location.accuracy,
      locationDecision: locationDecision.reason,
      locationDistanceM: locationDecision.distanceM,
      workSiteId: locationDecision.workSiteId || null,
      fieldAssignmentId: locationDecision.fieldAssignmentId || null,
      status,
      source: "authenticated_gps_web",
      exceptionId: exceptionSnap.exists ? exceptionSnap.id : null,
      deviceInfo: cleanText(request.data?.deviceInfo, 300),
      createdAt: FieldValue.serverTimestamp()
    });
    transaction.set(guardRef, { userId: employee.id, date, lastType: type, updatedAt: FieldValue.serverTimestamp() });
    if (exceptionSnap.exists) {
      transaction.set(exceptionSnap.ref, { laterPunchAt: Timestamp.fromDate(now), laterPunchType: type, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  await rebuildAttendanceDaily(employee, date, settings);
  await audit("attendance.punched", employee, {
    targetUserId: employee.id,
    department: employee.department,
    recordId: recordRef.id,
    type,
    locationDecision: locationDecision.reason
  });
  return { success: true, recordId: recordRef.id, timestamp: now.toISOString(), status, locationDecision: locationDecision.reason };
});

exports.submitExceptionReason = callable(async function submitExceptionReason(request) {
  const employee = await profileFor(request.auth.uid);
  if (employee.isActive === false || employee.attendanceRequired === false) {
    throw new HttpsError("failed-precondition", "此帳號目前不適用未打卡申請。");
  }
  const date = cleanText(request.data?.date, 10);
  if (request.data?.missingType && !["checkIn", "checkOut"].includes(request.data.missingType)) {
    throw new HttpsError("invalid-argument", "漏打卡類型無效。");
  }
  const missingType = request.data?.missingType === "checkOut" ? "checkOut" : "checkIn";
  const caseId = `${date}_${employee.id}${missingType === "checkOut" ? "_checkOut" : ""}`;
  const category = cleanText(request.data?.category, 40);
  const reason = cleanText(request.data?.reason, 1000);
  const requestedTime = cleanText(request.data?.requestedTime, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["forgot", "device_failure", "fieldwork", "leave_pending", "other"].includes(category)
    || !reason || !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)) {
    throw new HttpsError("invalid-argument", "請選擇原因分類，並填寫實際時間與說明。");
  }
  const ref = db.doc(`attendanceExceptions/${caseId}`);
  const snap = await ref.get();
  if (snap.exists && snap.data().userId !== employee.id) throw new HttpsError("permission-denied", "你無權處理此案件。");
  if (snap.exists && !["pending_employee_reason", "overdue", "needs_more_info"].includes(snap.data().status)) {
    throw new HttpsError("failed-precondition", "此案件已送審或結案。");
  }
  const settingsSnap = await db.doc("workSettings/default").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const shift = normalizedShift(employee, settings);
  if (snap.data()?.status !== "needs_more_info") {
    const candidates = await missingAttendanceCandidates(employee, settings, [date]);
    if (!candidates.some((item) => item.missingType === missingType)) {
      throw new HttpsError("failed-precondition", "該日期不符合這項漏打卡申請條件。");
    }
  }
  if (missingType === "checkOut") {
    const rows = await recordsForDate(employee.id, date);
    if (!validCheckoutCorrectionTime(rows, date, requestedTime)) {
      throw new HttpsError("invalid-argument", "實際離開時間必須晚於當日簽到時間。");
    }
  }
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    if (latest.exists && (latest.data().userId !== employee.id
      || !["pending_employee_reason", "overdue", "needs_more_info"].includes(latest.data().status))) {
      throw new HttpsError("failed-precondition", "案件狀態已變更，請重新載入。");
    }
    transaction.set(ref, {
      ...(latest.exists ? {} : {
        userId: employee.id,
        userName: employee.name || employee.email || "",
        department: employee.department || "",
        managerId: employee.managerId || "",
        date,
        shiftId: shift.id,
        shiftName: shift.name,
        workStart: shift.workStart,
        workEnd: effectiveWorkEnd(date, shift, settings),
        missingType,
        dueAt: Timestamp.fromDate(new Date(taipeiDateTime(date, missingType === "checkOut" ? effectiveWorkEnd(date, shift, settings) : shift.workStart).getTime()
          + Number(missingType === "checkOut" ? settings.punchWindowMinutes || 13 : settings.lateGraceMinutes || 0) * 60000)),
        createdAt: FieldValue.serverTimestamp()
      }),
      reasonCategory: category,
      reason,
      requestedTime,
      status: "pending_manager_review",
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({ action: "reason_submitted", actorId: employee.id, at: now.toISOString() })
    }, { merge: true });
  });
  await audit("attendance_exception.reason_submitted", employee, { targetUserId: employee.id, department: employee.department, caseId, category, missingType });
  return { status: "pending_manager_review" };
});

exports.reviewException = callable(async function reviewException(request) {
  const reviewer = await profileFor(request.auth.uid);
  const caseId = cleanText(request.data?.caseId, 128);
  const decision = cleanText(request.data?.decision, 40);
  const note = cleanText(request.data?.note, 1000);
  if (!["approved", "rejected", "needs_more_info"].includes(decision)) throw new HttpsError("invalid-argument", "審核決定無效。");
  const ref = db.doc(`attendanceExceptions/${caseId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "找不到未打卡案件。");
  const exception = snap.data();
  const missingType = exception.missingType === "checkOut" ? "checkOut" : "checkIn";
  const employee = await profileFor(exception.userId);
  requireReviewer(reviewer, employee);
  if (exception.status !== "pending_manager_review" && !(exception.status === "approved" && decision === "approved")) {
    throw new HttpsError("failed-precondition", "只有已送審案件可以審核；已核准案件僅能補回出勤紀錄。");
  }
  const status = decision === "needs_more_info" ? "needs_more_info" : decision;
  let correctionRecordId = exception.manualCorrectionRecordId || "";
  let correctionTime = "";
  if (decision === "approved") {
    correctionTime = cleanText(request.data?.correctionTime, 5)
      || cleanText(exception.requestedTime, 5)
      || timeMentionedInReason(exception.reason)
      || cleanText(missingType === "checkOut" ? exception.workEnd : exception.workStart, 5)
      || (missingType === "checkOut" ? "18:00" : "09:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(correctionTime)) {
      throw new HttpsError("invalid-argument", "補登時間格式不正確。");
    }
    const rows = await recordsForDate(employee.id, exception.date);
    const existingPunch = rows.find((row) => row.type === missingType);
    if (missingType === "checkOut") {
      if (!validCheckoutCorrectionTime(rows, exception.date, correctionTime)) {
        throw new HttpsError("failed-precondition", "補登簽退時間必須晚於當日簽到時間。");
      }
    }
    if (existingPunch) {
      correctionRecordId = existingPunch.id;
    } else {
      const settingsSnap = await db.doc("workSettings/default").get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};
      const shift = normalizedShift(employee, settings);
      const timestamp = taipeiDateTime(exception.date, correctionTime);
      const approvedLeaves = await approvedLeavesForDate(employee.id, exception.date);
      const correctionRef = db.doc(`attendance/exception_${caseId}_${missingType}`);
      correctionRecordId = correctionRef.id;
      await correctionRef.set({
        userId: employee.id,
        userName: employee.name || employee.email || "",
        department: employee.department || "",
        type: missingType,
        shiftId: shift.id,
        shiftName: shift.name,
        workStart: shift.workStart,
        workEnd: shift.workEnd,
        lateGraceMinutes: Number(settings.lateGraceMinutes || 0),
        timestamp: Timestamp.fromDate(timestamp),
        serverReceivedAt: FieldValue.serverTimestamp(),
        date: exception.date,
        latitude: null,
        longitude: null,
        locationDecision: "manager_approved_exception",
        status: resolveStatusWithLeaves(missingType, timestamp, exception.date, shift, settings, approvedLeaves),
        source: "manager_approved_exception",
        manualCorrection: true,
        correctionReason: exception.reason || note || (missingType === "checkOut" ? "主管核准漏簽退原因" : "主管核准未打卡原因"),
        correctedBy: reviewer.id,
        correctedByName: reviewer.name || reviewer.email || "",
        exceptionId: caseId,
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await rebuildAttendanceDaily(employee, exception.date, settings);
      await audit("attendance.manager_correction", reviewer, {
        targetUserId: employee.id,
        department: employee.department,
        recordId: correctionRecordId,
        date: exception.date,
        time: correctionTime,
        type: missingType,
        caseId
      });
    }
  }
  await ref.update({
    status,
    reviewNote: note,
    ...(decision === "approved" ? { requestedTime: correctionTime, manualCorrectionRecordId: correctionRecordId } : {}),
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.name || reviewer.email || "",
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    timeline: FieldValue.arrayUnion({ action: `review_${decision}`, actorId: reviewer.id, at: new Date().toISOString(), note })
  });
  await audit("attendance_exception.reviewed", reviewer, { targetUserId: employee.id, department: employee.department, caseId, decision, note, missingType });
  return { status };
});

function timeMentionedInReason(reason) {
  const match = String(reason || "").match(/(?:^|\D)([01]?\d|2[0-3])[:：]([0-5]\d)(?:\D|$)/);
  return match ? `${String(match[1]).padStart(2, "0")}:${match[2]}` : "";
}

exports.saveWorkSite = callable(async function saveWorkSite(request) {
  const admin = await profileFor(request.auth.uid);
  requireAdmin(admin);
  const data = request.data || {};
  const name = cleanText(data.name, 100);
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const radiusM = Number(data.radiusM || 150);
  const maxAccuracyM = Number(data.maxAccuracyM || 100);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    || radiusM < 20 || radiusM > 5000 || maxAccuracyM < 10 || maxAccuracyM > 1000) {
    throw new HttpsError("invalid-argument", "據點名稱、座標、半徑或定位精度設定無效。");
  }
  const ref = data.id ? db.doc(`workSites/${cleanText(data.id, 128)}`) : db.collection("workSites").doc();
  await ref.set({ name, latitude, longitude, radiusM, maxAccuracyM, active: data.active !== false, updatedBy: admin.id, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit("work_site.saved", admin, { siteId: ref.id, name, latitude, longitude, radiusM, maxAccuracyM });
  return { id: ref.id };
});

exports.saveFieldAssignment = callable(async function saveFieldAssignment(request) {
  const admin = await profileFor(request.auth.uid);
  requireAdmin(admin);
  const data = request.data || {};
  const employee = await profileFor(cleanText(data.userId, 128));
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  const reason = cleanText(data.reason, 500);
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const radiusM = Number(data.radiusM || 150);
  if (!reason || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt
    || !Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusM < 20 || radiusM > 5000) {
    throw new HttpsError("invalid-argument", "外勤時段、地點、半徑或原因無效。");
  }
  const ref = data.id ? db.doc(`fieldAssignments/${cleanText(data.id, 128)}`) : db.collection("fieldAssignments").doc();
  await ref.set({
    userId: employee.id,
    userName: employee.name || employee.email || "",
    department: employee.department || "",
    name: cleanText(data.name, 100) || "核准外勤",
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    latitude,
    longitude,
    radiusM,
    maxAccuracyM: Number(data.maxAccuracyM || 150),
    reason,
    active: data.active !== false,
    assignedBy: admin.id,
    assignedByName: admin.name || admin.email || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await audit("field_assignment.saved", admin, { targetUserId: employee.id, department: employee.department, assignmentId: ref.id, reason });
  return { id: ref.id };
});

exports.createManualCorrection = callable(async function createManualCorrection(request) {
  const admin = await profileFor(request.auth.uid);
  requireAdmin(admin);
  const data = request.data || {};
  const employee = await profileFor(cleanText(data.userId, 128));
  const date = cleanText(data.date, 10);
  const type = data.type;
  const time = cleanText(data.time, 5);
  const reason = cleanText(data.reason, 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)
    || !["checkIn", "checkOut"].includes(type) || !reason) {
    throw new HttpsError("invalid-argument", "補登日期、時間、類型及原因必須完整。");
  }
  const timestamp = taipeiDateTime(date, time);
  const settingsSnap = await db.doc("workSettings/default").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const shift = normalizedShift(employee, settings);
  const [approvedLeaves, existingRows] = await Promise.all([
    approvedLeavesForDate(employee.id, date),
    recordsForDate(employee.id, date)
  ]);
  const hasEarlierCheckIn = type === "checkIn"
    && existingRows.some((row) => row.type === "checkIn" && timestampDate(row.timestamp) <= timestamp);
  const status = hasEarlierCheckIn
    ? "normal"
    : resolveStatusWithLeaves(type, timestamp, date, shift, settings, approvedLeaves);
  const ref = db.collection("attendance").doc();
  const exceptionId = cleanText(data.exceptionId, 128) || null;
  await ref.set({
    userId: employee.id,
    userName: employee.name || employee.email || "",
    department: employee.department || "",
    type,
    shiftId: shift.id,
    shiftName: shift.name,
    workStart: shift.workStart,
    workEnd: shift.workEnd,
    lateGraceMinutes: Number(settings.lateGraceMinutes || 0),
    timestamp: Timestamp.fromDate(timestamp),
    serverReceivedAt: FieldValue.serverTimestamp(),
    date,
    latitude: null,
    longitude: null,
    locationDecision: "manual_correction",
    status,
    source: "admin_manual_correction",
    manualCorrection: true,
    correctionReason: reason,
    correctedBy: admin.id,
    correctedByName: admin.name || admin.email || "",
    exceptionId,
    createdAt: FieldValue.serverTimestamp()
  });
  if (exceptionId) {
    await db.doc(`attendanceExceptions/${exceptionId}`).set({ manualCorrectionRecordId: ref.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await rebuildAttendanceDaily(employee, date, settings);
  await audit("attendance.manual_correction", admin, { targetUserId: employee.id, department: employee.department, recordId: ref.id, date, time, type, reason, exceptionId });
  return { recordId: ref.id };
});

function leaveCoversShift(leaveRows, userId, date, shift) {
  const start = taipeiDateTime(date, shift.workStart);
  const end = taipeiDateTime(date, shift.workEnd);
  return leaveRows.some((leave) => leave.userId === userId && leave.status === "approved"
    && timestampDate(leave.startTime) <= start && timestampDate(leave.endTime) >= end);
}

async function missingAttendanceCandidates(employee, settings, dates = recentDates(new Date())) {
  const now = new Date();
  const allowedDates = new Set(recentDates(now));
  const [attendanceSnap, leaveSnap] = await Promise.all([
    db.collection("attendance").where("userId", "==", employee.id).get(),
    db.collection("leaveRequests").where("userId", "==", employee.id).get()
  ]);
  const attendance = attendanceSnap.docs.map((item) => item.data());
  const leaves = leaveSnap.docs.map((item) => item.data());
  return selectMissingAttendanceCandidates({
    dates: dates.filter((date) => allowedDates.has(date)),
    now,
    employee,
    settings,
    shift: normalizedShift(employee, settings),
    attendance,
    leaves,
    leaveCoversShift
  });
}

exports.getMissingAttendanceCandidates = callable(async function getMissingAttendanceCandidates(request) {
  const employee = await profileFor(request.auth.uid);
  if (employee.isActive === false || employee.attendanceRequired === false) return { candidates: [] };
  const settingsSnap = await db.doc("workSettings/default").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const candidates = await missingAttendanceCandidates(employee, settings);
  const existingSnap = await db.collection("attendanceExceptions").where("userId", "==", employee.id).get();
  const formalDates = new Set(existingSnap.docs
    .filter((item) => !["pending_employee_reason", "overdue"].includes(item.data().status))
    .map((item) => `${item.data().date}:${item.data().missingType === "checkOut" ? "checkOut" : "checkIn"}`));
  return { candidates: candidates.filter((item) => !formalDates.has(`${item.date}:${item.missingType}`)) };
});
