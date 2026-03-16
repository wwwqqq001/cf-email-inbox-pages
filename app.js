const STORAGE_KEY = "cf-mail-inbox-settings";
const DEFAULT_API_BASE_URL = "https://cf-email-inbox.wwwqqq001.workers.dev";

const state = {
  activeEmailId: "",
  activeMailbox: "all",
  cursor: null,
  detail: null,
  emails: [],
  mailboxes: [],
  settings: loadSettings(),
  view: "html"
};

const elements = {
  apiBaseUrl: document.querySelector("#api-base-url"),
  apiToken: document.querySelector("#api-token"),
  closeSettings: document.querySelector("#close-settings"),
  clearSettings: document.querySelector("#clear-settings"),
  detailAttachments: document.querySelector("#detail-attachments"),
  detailCard: document.querySelector("#detail-card"),
  detailCc: document.querySelector("#detail-cc"),
  detailDate: document.querySelector("#detail-date"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailFlags: document.querySelector("#detail-flags"),
  detailFrom: document.querySelector("#detail-from"),
  detailHeaders: document.querySelector("#detail-headers"),
  detailMailbox: document.querySelector("#detail-mailbox"),
  detailMessageId: document.querySelector("#detail-message-id"),
  detailSubject: document.querySelector("#detail-subject"),
  detailSubtitle: document.querySelector("#detail-subtitle"),
  detailText: document.querySelector("#detail-text"),
  detailTo: document.querySelector("#detail-to"),
  downloadRaw: document.querySelector("#download-raw"),
  emailList: document.querySelector("#email-list"),
  htmlFrame: document.querySelector("#html-frame"),
  listSubtitle: document.querySelector("#list-subtitle"),
  listTitle: document.querySelector("#list-title"),
  loadMore: document.querySelector("#load-more"),
  mailboxList: document.querySelector("#mailbox-list"),
  openSettings: document.querySelector("#open-settings"),
  refreshEmails: document.querySelector("#refresh-emails"),
  reloadMailboxes: document.querySelector("#reload-mailboxes"),
  searchInput: document.querySelector("#search-input"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  starredOnly: document.querySelector("#starred-only"),
  statusPill: document.querySelector("#status-pill"),
  tabs: document.querySelectorAll(".tab"),
  toggleRead: document.querySelector("#toggle-read"),
  toggleStar: document.querySelector("#toggle-star"),
  unreadOnly: document.querySelector("#unread-only")
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      baseUrl: saved.baseUrl || DEFAULT_API_BASE_URL,
      token: saved.token || ""
    };
  } catch {
    return { baseUrl: DEFAULT_API_BASE_URL, token: "" };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function apiUrl(path, params = {}) {
  const url = new URL(path, state.settings.baseUrl.replace(/\/$/, "") + "/");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path, options.query), {
    ...options,
    headers: {
      Authorization: `Bearer ${state.settings.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  if (options.raw) {
    return response.blob();
  }

  return response.json();
}

function setStatus(text, online = false) {
  elements.statusPill.textContent = text;
  elements.statusPill.classList.toggle("is-online", online);
}

function formatAddress(entry) {
  if (!entry) {
    return "—";
  }
  return entry.name ? `${entry.name} <${entry.address}>` : entry.address || "—";
}

function formatAddresses(items = []) {
  return items.length ? items.map(formatAddress).join(", ") : "—";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("zh-CN") : "—";
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMailboxes() {
  const items = [
    { mailbox: "all", latestReceivedAt: null, countEstimate: state.emails.length, label: "全部邮件" },
    ...state.mailboxes.map((item) => ({ ...item, label: item.mailbox }))
  ];

  elements.mailboxList.innerHTML = items.map((item) => `
    <button class="mailbox-item ${state.activeMailbox === item.mailbox ? "is-active" : ""}" data-mailbox="${item.mailbox}">
      <div class="mailbox-item__name">${escapeHtml(item.label)}</div>
      <div class="mailbox-item__meta">
        <span>${item.countEstimate ?? 0} 封</span>
        <span>${item.latestReceivedAt ? formatDate(item.latestReceivedAt) : "全部"}</span>
      </div>
    </button>
  `).join("");

  elements.mailboxList.querySelectorAll("[data-mailbox]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMailbox = button.dataset.mailbox;
      state.cursor = null;
      loadEmails(false);
      renderMailboxes();
    });
  });
}

function renderEmails() {
  if (!state.emails.length) {
    elements.emailList.className = "email-list empty-state";
    elements.emailList.innerHTML = `
      <div>
        <h3>当前没有可显示的邮件</h3>
        <p>试试切换收件箱、清空筛选条件，或者确认 Worker 已收到邮件。</p>
      </div>
    `;
    return;
  }

  elements.emailList.className = "email-list";
  elements.emailList.innerHTML = state.emails.map((item) => `
    <article class="email-item ${state.activeEmailId === item.id ? "is-active" : ""}" data-email-id="${item.id}">
      <div class="email-item__top">
        <strong class="email-item__subject">${escapeHtml(item.subject)}</strong>
        <span>${formatDate(item.receivedAt)}</span>
      </div>
      <div class="email-item__meta">
        <span>${escapeHtml(formatAddress(item.from))}</span>
        <span>${escapeHtml(item.mailbox)}</span>
      </div>
      <p class="email-item__snippet">${escapeHtml(item.snippet || "无摘要")}</p>
      <div class="email-item__bottom">
        <div class="email-item__flags">
          <span class="dot ${item.read ? "is-read" : ""}"></span>
          ${item.starred ? '<span class="star">★</span>' : ""}
          ${item.hasAttachments ? '<span class="badge">附件</span>' : ""}
        </div>
        <span>${item.rawByteLength || 0} B</span>
      </div>
    </article>
  `).join("");

  elements.emailList.querySelectorAll("[data-email-id]").forEach((node) => {
    node.addEventListener("click", () => loadDetail(node.dataset.emailId));
  });
}

function renderDetail(detail) {
  if (!detail) {
    elements.detailCard.classList.add("hidden");
    elements.detailEmpty.classList.remove("hidden");
    elements.toggleRead.disabled = true;
    elements.toggleStar.disabled = true;
    elements.downloadRaw.disabled = true;
    return;
  }

  elements.detailCard.classList.remove("hidden");
  elements.detailEmpty.classList.add("hidden");
  elements.toggleRead.disabled = false;
  elements.toggleStar.disabled = false;
  elements.downloadRaw.disabled = false;

  elements.detailMailbox.textContent = detail.mailbox;
  elements.detailFlags.textContent = `${detail.read ? "已读" : "未读"} / ${detail.starred ? "已星标" : "未星标"}`;
  elements.detailSubject.textContent = detail.subject;
  elements.detailDate.textContent = formatDate(detail.receivedAt);
  elements.detailFrom.textContent = formatAddress(detail.from);
  elements.detailTo.textContent = formatAddresses(detail.to);
  elements.detailCc.textContent = formatAddresses(detail.cc);
  elements.detailMessageId.textContent = detail.messageId || "—";
  elements.detailText.textContent = detail.textBody || "无纯文本正文";
  elements.detailHeaders.textContent = detail.headers.map((header) => `${header.key}: ${header.value}`).join("\n");
  elements.detailAttachments.innerHTML = detail.attachments.length
    ? detail.attachments.map((file) => `
        <div class="attachment-card">
          <div>
            <strong>${escapeHtml(file.filename)}</strong>
            <p>${escapeHtml(file.contentType)}</p>
          </div>
          <span>${file.size} B</span>
        </div>
      `).join("")
    : "<p>没有附件。</p>";

  const htmlBody = detail.htmlBody || '<p style="font-family:sans-serif;padding:16px;">无 HTML 正文。</p>';
  elements.htmlFrame.srcdoc = htmlBody;
  elements.detailSubtitle.textContent = `收件箱：${detail.mailbox} · 到期时间戳：${detail.expiresAt}`;
  elements.toggleRead.textContent = detail.read ? "标记未读" : "标记已读";
  elements.toggleStar.textContent = detail.starred ? "取消星标" : "星标";
}

async function loadMailboxes() {
  if (!state.settings.baseUrl || !state.settings.token) {
    return;
  }

  const payload = await request("/api/mailboxes");
  state.mailboxes = payload.items || [];
  renderMailboxes();
}

async function loadEmails(append = false) {
  if (!state.settings.baseUrl || !state.settings.token) {
    setStatus("请先配置连接", false);
    return;
  }

  setStatus("加载中…", true);
  const payload = await request("/api/emails", {
    query: {
      cursor: append ? state.cursor : null,
      limit: 25,
      mailbox: state.activeMailbox,
      q: elements.searchInput.value.trim(),
      starred: elements.starredOnly.checked,
      unread: elements.unreadOnly.checked
    }
  });

  state.cursor = payload.nextCursor;
  state.emails = append ? [...state.emails, ...payload.items] : payload.items;
  elements.listTitle.textContent = state.activeMailbox === "all" ? "全部邮件" : `${state.activeMailbox} 收件箱`;
  elements.listSubtitle.textContent = `已加载 ${state.emails.length} 封${payload.listComplete ? "（已到底）" : ""}`;
  elements.loadMore.disabled = !state.cursor;
  renderEmails();
  setStatus("已连接", true);
}

async function loadDetail(id) {
  state.activeEmailId = id;
  renderEmails();
  const payload = await request(`/api/emails/${id}`);
  state.detail = payload.item;
  renderDetail(state.detail);
}

async function toggleFlag(flag) {
  if (!state.detail) {
    return;
  }

  const patch = { [flag]: !state.detail[flag] };
  const payload = await request(`/api/emails/${state.detail.id}`, {
    body: JSON.stringify(patch),
    method: "PATCH"
  });

  state.detail = payload.item;
  state.emails = state.emails.map((item) => item.id === state.detail.id
    ? {
        ...item,
        read: state.detail.read,
        starred: state.detail.starred
      }
    : item);
  renderEmails();
  renderDetail(state.detail);
}

async function downloadRaw() {
  if (!state.detail) {
    return;
  }

  const blob = await request(`/api/emails/${state.detail.id}/raw`, { raw: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.detail.id}.eml`;
  link.click();
  URL.revokeObjectURL(url);
}

async function checkHealth() {
  if (!state.settings.baseUrl) {
    return;
  }

  try {
    const response = await fetch(apiUrl("/api/health"));
    if (!response.ok) {
      throw new Error("health check failed");
    }
    setStatus("已连接", true);
  } catch {
    setStatus("连接失败", false);
  }
}

function syncSettingsForm() {
  elements.apiBaseUrl.value = state.settings.baseUrl;
  elements.apiToken.value = state.settings.token;
}

function setView(view) {
  state.view = view;
  elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `view-${view}`);
  });
}

function bindEvents() {
  elements.openSettings.addEventListener("click", () => elements.settingsDialog.showModal());
  elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
  elements.reloadMailboxes.addEventListener("click", () => loadMailboxes().catch((error) => alert(error.message)));
  elements.refreshEmails.addEventListener("click", () => loadEmails(false).catch((error) => alert(error.message)));
  elements.loadMore.addEventListener("click", () => loadEmails(true).catch((error) => alert(error.message)));
  elements.toggleRead.addEventListener("click", () => toggleFlag("read").catch((error) => alert(error.message)));
  elements.toggleStar.addEventListener("click", () => toggleFlag("starred").catch((error) => alert(error.message)));
  elements.downloadRaw.addEventListener("click", () => downloadRaw().catch((error) => alert(error.message)));

  [elements.searchInput, elements.unreadOnly, elements.starredOnly].forEach((node) => {
    node.addEventListener("change", () => loadEmails(false).catch((error) => alert(error.message)));
  });

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.settings = {
      baseUrl: elements.apiBaseUrl.value.trim() || DEFAULT_API_BASE_URL,
      token: elements.apiToken.value.trim()
    };
    saveSettings(state.settings);
    elements.settingsDialog.close();
    await checkHealth();
    await loadMailboxes();
    await loadEmails(false);
  });

  elements.clearSettings.addEventListener("click", () => {
    state.settings = { baseUrl: DEFAULT_API_BASE_URL, token: "" };
    saveSettings(state.settings);
    syncSettingsForm();
    setStatus("未连接", false);
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
}

async function init() {
  syncSettingsForm();
  bindEvents();
  setView("html");
  await checkHealth();
  if (state.settings.baseUrl && state.settings.token) {
    await loadMailboxes();
    await loadEmails(false);
  }
}

init().catch((error) => {
  setStatus(`初始化失败：${error.message}`, false);
});
