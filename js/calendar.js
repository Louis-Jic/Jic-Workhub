import { requireAuth, bindLogout, mountPageShell, qs, leaveTypeLabel, callSecureFunction } from "./app.js";

mountPageShell("休假行事曆", "檢視已核准請假的團隊排程");
await requireAuth();
bindLogout();

let visibleMonth = startOfMonth(new Date());

qs("#pageContent").innerHTML = `
  <div class="panel p-3">
    <div class="calendar-title calendar-title-with-controls d-flex justify-content-between align-items-center mb-3">
      <div class="calendar-month-heading d-flex align-items-center gap-2 flex-wrap">
        <h2 class="h5 mb-0" id="calendarMonthTitle"></h2>
        <span class="badge calendar-legend calendar-legend-leave">已核准請假</span>
        <span class="badge calendar-legend calendar-legend-company">公司活動</span>
        <span class="badge calendar-legend calendar-legend-inventory">公司盤點</span>
        <span class="badge calendar-legend calendar-legend-training">教育訓練</span>
        <span class="badge calendar-legend calendar-legend-meeting">會議</span>
        <span class="badge calendar-legend calendar-legend-holiday">假日公告</span>
      </div>
      <div class="calendar-month-controls d-flex align-items-center gap-2 flex-wrap">
        <button class="btn btn-outline-secondary btn-sm" id="prevMonthBtn" type="button">上個月</button>
        <button class="btn btn-outline-primary btn-sm" id="todayMonthBtn" type="button">今天</button>
        <button class="btn btn-outline-secondary btn-sm" id="nextMonthBtn" type="button">下個月</button>
      </div>
    </div>
    <div class="calendar-grid" id="calendar"></div>
    <div class="calendar-list" id="calendarList"></div>
    <button class="btn btn-primary calendar-mobile-today-jump" id="mobileTodayJumpBtn" type="button" hidden>
      今天
    </button>
    <dialog class="calendar-detail-dialog" id="calendarDetailDialog" aria-labelledby="calendarDetailTitle">
      <div class="calendar-detail-header">
        <div>
          <div class="small muted" id="calendarDetailKind">詳情</div>
          <h3 class="h5 mb-0" id="calendarDetailTitle"></h3>
        </div>
        <button class="calendar-detail-close" type="button" data-calendar-detail-close aria-label="關閉">×</button>
      </div>
      <dl class="calendar-detail-grid mb-0" id="calendarDetailContent"></dl>
      <div class="calendar-detail-actions">
        <button class="btn btn-primary" type="button" data-calendar-detail-close>關閉</button>
      </div>
    </dialog>
  </div>`;

let teamCalendar = { leaves: [], companyEvents: [] };
try {
  teamCalendar = await callSecureFunction("getTeamCalendar");
} catch (error) {
  qs("#pageContent").insertAdjacentHTML(
    "afterbegin",
    `<div class="alert alert-danger">
      <strong>團隊行事曆資料載入失敗。</strong>
      <div data-calendar-load-error></div>
    </div>`
  );
  qs("[data-calendar-load-error]").textContent =
    error?.message || "請重新整理後再試。";
  console.error("團隊行事曆資料載入失敗", error);
}
const allLeaves = Array.isArray(teamCalendar?.leaves) ? teamCalendar.leaves : [];
const allCompanyEvents = Array.isArray(teamCalendar?.companyEvents) ? teamCalendar.companyEvents : [];

qs("#prevMonthBtn").addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendarMonth();
});

qs("#nextMonthBtn").addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendarMonth();
});

function jumpToToday() {
  const today = new Date();
  visibleMonth = startOfMonth(today);
  renderCalendarMonth();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollToCalendarDate(today));
  });
}

qs("#todayMonthBtn").addEventListener("click", jumpToToday);
qs("#mobileTodayJumpBtn").addEventListener("click", jumpToToday);

const mobileCalendarQuery = window.matchMedia("(max-width: 640px)");
const calendarToolbar = qs(".calendar-title-with-controls");
const mobileTodayJump = qs("#mobileTodayJumpBtn");

function updateMobileTodayJump(toolbarVisible) {
  mobileTodayJump.hidden = !mobileCalendarQuery.matches || toolbarVisible;
}

const calendarToolbarObserver = new IntersectionObserver(([entry]) => {
  updateMobileTodayJump(entry.isIntersecting);
}, { threshold: 0.25 });

calendarToolbarObserver.observe(calendarToolbar);
mobileCalendarQuery.addEventListener("change", () => {
  const toolbarRect = calendarToolbar.getBoundingClientRect();
  updateMobileTodayJump(toolbarRect.bottom > 79 && toolbarRect.top < window.innerHeight);
});

qs("#pageContent").addEventListener("click", (event) => {
  const leaveButton = event.target.closest("[data-calendar-leave-index]");
  if (leaveButton) {
    openLeaveDetail(allLeaves[Number(leaveButton.dataset.calendarLeaveIndex)]);
    return;
  }
  const companyButton = event.target.closest("[data-company-event-index]");
  if (companyButton) {
    openCompanyEventDetail(allCompanyEvents[Number(companyButton.dataset.companyEventIndex)]);
    return;
  }
  if (event.target.closest("[data-calendar-detail-close]")) {
    qs("#calendarDetailDialog").close();
  }
});

qs("#calendarDetailDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

renderCalendarMonth();

function renderCalendarMonth() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const events = allLeaves.filter((item) => {
    const start = toDate(item.startTime);
    const end = toDate(item.endTime);
    return start <= monthEnd && end >= monthStart;
  });
  const monthStartKey = calendarDateKey(monthStart);
  const monthEndKey = calendarDateKey(monthEnd);
  const companyEvents = allCompanyEvents.filter((item) => (
    item.startDate <= monthEndKey && item.endDate >= monthStartKey
  ));

  qs("#calendarMonthTitle").textContent = `${year} 年 ${month + 1} 月`;
  renderLeaveCalendar(year, month, monthStart, monthEnd, events, companyEvents);
}

function renderLeaveCalendar(year, month, monthStart, monthEnd, events, companyEvents) {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const cells = days.map((day) => `<div class="calendar-head">${day}</div>`);
  const listItems = [];

  for (let i = 0; i < monthStart.getDay(); i += 1) {
    cells.push(`<div class="calendar-cell bg-light"></div>`);
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const dateKey = calendarDateKey(date);
    const isToday = sameDate(date, new Date());
    const dayEvents = events.filter((item) => isEventOnDate(item, date));
    const dayCompanyEvents = companyEvents.filter((item) => isCompanyEventOnDate(item, dateKey));
    cells.push(`<div class="calendar-cell${isToday ? " is-today" : ""}" data-calendar-date="${dateKey}"${isToday ? ' aria-current="date"' : ""}>
      <div class="fw-semibold">${day}</div>
      ${dayCompanyEvents.map((item) => companyEventHtml(item)).join("")}
      ${dayEvents.map((item) => calendarEventHtml(item)).join("")}
    </div>`);

    if (dayEvents.length || dayCompanyEvents.length || isToday) {
      listItems.push(`<div class="calendar-list-item${isToday ? " is-today" : ""}" data-calendar-date="${dateKey}"${isToday ? ' aria-current="date"' : ""}>
        <div class="calendar-list-date">
          <span class="calendar-list-day">${day}</span>
          <span class="calendar-list-week">${days[date.getDay()]}</span>
        </div>
        <div class="calendar-list-events">
          ${dayCompanyEvents.map((item) => companyEventListHtml(item)).join("")}
          ${dayEvents.map((item) => `<button class="calendar-list-event" type="button" data-calendar-leave-index="${allLeaves.indexOf(item)}">
            <div class="calendar-list-event-person">
              <strong>${escapeHtml(item.userName)}</strong>
              <span>${escapeHtml(leaveTypeLabel(item.leaveType))}</span>
            </div>
            <span class="calendar-event-arrow" aria-hidden="true">›</span>
          </button>`).join("")}
          ${!dayEvents.length && !dayCompanyEvents.length ? '<div class="calendar-list-empty-day">今天沒有請假或公司活動</div>' : ""}
        </div>
      </div>`);
    }
  }

  qs("#calendar").innerHTML = cells.join("");
  qs("#calendarList").innerHTML = listItems.length
    ? listItems.join("")
    : `<div class="muted py-3">本月沒有已核准請假或公司活動。</div>`;
}

function scrollToCalendarDate(date) {
  const dateKey = calendarDateKey(date);
  const mobileTarget = qs(`#calendarList [data-calendar-date="${dateKey}"]`);
  const desktopTarget = qs(`#calendar [data-calendar-date="${dateKey}"]`);
  const target = window.matchMedia("(max-width: 767px)").matches
    ? mobileTarget || desktopTarget
    : desktopTarget || mobileTarget;
  target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function calendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarEventHtml(item) {
  const name = escapeHtml(item.userName);
  const leaveType = escapeHtml(leaveTypeLabel(item.leaveType));
  const details = escapeHtml(calendarEventDetails(item));
  return `<button class="calendar-event" type="button" data-calendar-leave-index="${allLeaves.indexOf(item)}" title="${details}" aria-label="查看 ${name} ${leaveType}的休假詳情">
    <span class="calendar-event-person"><strong>${name}</strong> ${leaveType}</span>
    <span class="calendar-event-arrow" aria-hidden="true">›</span>
  </button>`;
}

function companyEventHtml(item) {
  const title = escapeHtml(item.title);
  const category = escapeHtml(companyEventCategoryLabel(item.category));
  const colorClass = companyEventColorClass(item.category);
  return `<button class="calendar-event calendar-company-event ${colorClass}" type="button" data-company-event-index="${allCompanyEvents.indexOf(item)}" title="${escapeHtml(companyEventDetails(item))}" aria-label="查看公司活動 ${title}">
    <span class="calendar-event-person"><strong>${category}</strong> ${title}</span>
    <span class="calendar-event-arrow" aria-hidden="true">›</span>
  </button>`;
}

function companyEventListHtml(item) {
  const colorClass = companyEventColorClass(item.category);
  return `<button class="calendar-list-event calendar-company-event ${colorClass}" type="button" data-company-event-index="${allCompanyEvents.indexOf(item)}">
    <div class="calendar-list-event-person">
      <strong>${escapeHtml(companyEventCategoryLabel(item.category))}</strong>
      <span>${escapeHtml(item.title)}</span>
    </div>
    <span class="calendar-event-arrow" aria-hidden="true">›</span>
  </button>`;
}

function openLeaveDetail(item) {
  if (!item) return;
  const start = toDate(item.startTime);
  const end = toDate(item.endTime);
  qs("#calendarDetailKind").textContent = "休假詳情";
  qs("#calendarDetailTitle").textContent = item.userName || "員工";
  qs("#calendarDetailContent").innerHTML = `
    <div><dt>部門</dt><dd>${escapeHtml(item.department || "-")}</dd></div>
    <div><dt>假別</dt><dd>${escapeHtml(leaveTypeLabel(item.leaveType))}</dd></div>
    <div class="calendar-detail-wide"><dt>請假時間</dt><dd>${escapeHtml(`${formatDateTime(start)} 至 ${formatDateTime(end)}`)}</dd></div>
    <div class="calendar-detail-wide"><dt>核准時數</dt><dd>${escapeHtml(formatLeaveHours(resolveLeaveHours(item)) || "未提供")}</dd></div>`;
  qs("#calendarDetailDialog").showModal();
}

function openCompanyEventDetail(item) {
  if (!item) return;
  qs("#calendarDetailKind").textContent = companyEventCategoryLabel(item.category);
  qs("#calendarDetailTitle").textContent = item.title || "公司活動";
  qs("#calendarDetailContent").innerHTML = `
    <div><dt>類型</dt><dd>${escapeHtml(companyEventCategoryLabel(item.category))}</dd></div>
    <div><dt>時間</dt><dd>${escapeHtml(item.allDay !== false ? "全天" : `${item.startTime}～${item.endTime}`)}</dd></div>
    <div class="calendar-detail-wide"><dt>活動日期</dt><dd>${escapeHtml(companyEventDateRange(item))}</dd></div>
    <div class="calendar-detail-wide"><dt>公告說明</dt><dd>${escapeHtml(item.description || "未提供")}</dd></div>`;
  qs("#calendarDetailDialog").showModal();
}

function companyEventCategoryLabel(category) {
  return ({
    company_activity: "公司活動",
    inventory: "公司盤點",
    training: "教育訓練",
    meeting: "會議",
    holiday_notice: "假日公告",
    other: "其他"
  })[category] || "公司活動";
}

function companyEventColorClass(category) {
  return ({
    company_activity: "calendar-company-event-activity",
    inventory: "calendar-company-event-inventory",
    training: "calendar-company-event-training",
    meeting: "calendar-company-event-meeting",
    holiday_notice: "calendar-company-event-holiday",
    other: "calendar-company-event-other"
  })[category] || "calendar-company-event-other";
}

function companyEventDateRange(item) {
  return item.startDate === item.endDate
    ? item.startDate
    : `${item.startDate} 至 ${item.endDate}`;
}

function companyEventDetails(item) {
  const time = item.allDay !== false ? "全天" : `${item.startTime}～${item.endTime}`;
  return `${companyEventCategoryLabel(item.category)}｜${item.title}｜${companyEventDateRange(item)}｜${time}`;
}

function calendarEventDetails(item) {
  const start = toDate(item.startTime);
  const end = toDate(item.endTime);
  const hours = formatLeaveHours(resolveLeaveHours(item));
  return `${item.userName}｜${leaveTypeLabel(item.leaveType)}｜${formatDateTime(start)} 至 ${formatDateTime(end)}${hours ? `｜${hours}` : ""}`;
}

function resolveLeaveHours(item) {
  const approvedHours = Number(item.hours);
  if (Number.isFinite(approvedHours) && approvedHours > 0) return approvedHours;

  const start = toDate(item.startTime);
  const end = toDate(item.endTime);
  if (!sameDate(start, end)) return 0;

  const settings = teamCalendar?.attendanceSettings || {};
  const lunchStart = timeOnDate(start, settings.lunchStart || "12:00");
  const lunchEnd = timeOnDate(start, settings.lunchEnd || "13:00");
  const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  const lunchOverlapMinutes = Math.max(
    0,
    (Math.min(end.getTime(), lunchEnd.getTime()) - Math.max(start.getTime(), lunchStart.getTime())) / 60000
  );
  return Math.max(0, totalMinutes - lunchOverlapMinutes) / 60;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function timeOnDate(date, value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatLeaveHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return "";
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小時`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function isEventOnDate(item, date) {
  const start = toDate(item.startTime);
  const end = toDate(item.endTime);
  return start <= new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    && end >= new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isCompanyEventOnDate(item, dateKey) {
  return item.startDate <= dateKey && item.endDate >= dateKey;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDate(value) {
  if (!value) return new Date("");
  return value.toDate ? value.toDate() : new Date(value);
}
