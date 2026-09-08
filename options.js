"use strict";

const STORAGE_KEY = "mappings";

const state = {
  shortcut: null,
  image: null,
  capturing: false,
};

const els = {
  name: document.getElementById("nameInput"),
  shortcutDisplay: document.getElementById("shortcutDisplay"),
  captureBtn: document.getElementById("captureBtn"),
  clearShortcutBtn: document.getElementById("clearShortcutBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  preview: document.getElementById("preview"),
  previewWrap: document.getElementById("previewWrap"),
  previewInfo: document.getElementById("previewInfo"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status"),
  list: document.getElementById("mappingList"),
};

function showStatus(msg, isError) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", !!isError);
  els.status.classList.add("show");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => els.status.classList.remove("show"), 3000);
}

function shortcutToString(sc) {
  if (!sc) return "";
  const parts = [];
  if (sc.ctrl) parts.push("Ctrl");
  if (sc.meta) parts.push("Cmd");
  if (sc.alt) parts.push("Alt");
  if (sc.shift) parts.push("Shift");
  parts.push(sc.keyLabel || sc.key);
  return parts.join(" + ");
}

function renderShortcut() {
  const s = shortcutToString(state.shortcut);
  if (state.capturing) {
    els.shortcutDisplay.textContent = "Đang chờ... nhấn tổ hợp phím";
    els.shortcutDisplay.classList.add("capturing");
    els.shortcutDisplay.classList.remove("filled");
  } else if (s) {
    els.shortcutDisplay.textContent = s;
    els.shortcutDisplay.classList.add("filled");
    els.shortcutDisplay.classList.remove("capturing");
  } else {
    els.shortcutDisplay.textContent = "Bấm «Capture» rồi nhấn tổ hợp phím";
    els.shortcutDisplay.classList.remove("filled", "capturing");
  }
}

function stopCapture() {
  state.capturing = false;
  document.removeEventListener("keydown", onCaptureKey, true);
  renderShortcut();
}

function onCaptureKey(e) {
  if (!state.capturing) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    stopCapture();
    return;
  }
  const modOnly = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
  if (modOnly) return;
  const hasMod = e.ctrlKey || e.altKey || e.metaKey || e.shiftKey;
  if (!hasMod) {
    showStatus("Cần ít nhất 1 modifier (Ctrl/Alt/Shift/Cmd).", true);
    return;
  }
  state.shortcut = {
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    code: e.code,
    keyLabel: e.key.length === 1 ? e.key.toUpperCase() : e.key,
  };
  stopCapture();
}

els.captureBtn.addEventListener("click", () => {
  state.capturing = true;
  renderShortcut();
  document.addEventListener("keydown", onCaptureKey, true);
});

els.clearShortcutBtn.addEventListener("click", () => {
  state.shortcut = null;
  renderShortcut();
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showStatus("File không phải ảnh.", true);
    return;
  }
  const dataUrl = await readFileAsDataURL(file);
  state.image = {
    dataUrl,
    mimeType: file.type,
    fileName: file.name,
    size: file.size,
  };
  els.preview.src = dataUrl;
  els.previewWrap.style.display = "block";
  const kb = (file.size / 1024).toFixed(1);
  els.previewInfo.textContent = `${file.name} · ${file.type} · ${kb} KB`;
}

els.dropzone.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleFile(file);
});
["dragenter", "dragover"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    els.dropzone.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("drag");
  })
);
els.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFile(file);
});

async function loadMappings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveMappings(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

function shortcutsEqual(a, b) {
  return (
    !!a && !!b &&
    a.ctrl === b.ctrl &&
    a.shift === b.shift &&
    a.alt === b.alt &&
    a.meta === b.meta &&
    a.code === b.code
  );
}

els.saveBtn.addEventListener("click", async () => {
  if (!state.shortcut) {
    showStatus("Chưa chọn tổ hợp phím.", true);
    return;
  }
  if (!state.image) {
    showStatus("Chưa chọn ảnh.", true);
    return;
  }
  const list = await loadMappings();
  if (list.some((m) => shortcutsEqual(m.shortcut, state.shortcut))) {
    showStatus("Tổ hợp phím này đã được dùng.", true);
    return;
  }
  list.push({
    id: crypto.randomUUID(),
    name: els.name.value.trim() || state.image.fileName,
    shortcut: state.shortcut,
    image: state.image,
    createdAt: Date.now(),
  });
  try {
    await saveMappings(list);
  } catch (err) {
    showStatus("Lưu thất bại (có thể ảnh quá lớn): " + err.message, true);
    return;
  }
  els.name.value = "";
  state.shortcut = null;
  state.image = null;
  els.fileInput.value = "";
  els.preview.src = "";
  els.previewWrap.style.display = "none";
  renderShortcut();
  showStatus("Đã lưu.");
  renderList();
});

async function renderList() {
  const list = await loadMappings();
  els.list.innerHTML = "";
  if (!list.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "Chưa có cặp nào.";
    els.list.appendChild(d);
    return;
  }
  for (const m of list) {
    const row = document.createElement("div");
    row.className = "mapping";
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = m.image.dataUrl;
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = m.name;
    const kbd = document.createElement("div");
    const span = document.createElement("span");
    span.className = "kbd";
    span.textContent = shortcutToString(m.shortcut);
    kbd.appendChild(span);
    meta.appendChild(name);
    meta.appendChild(kbd);
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Xoá";
    del.addEventListener("click", async () => {
      if (!confirm(`Xoá "${m.name}"?`)) return;
      const cur = await loadMappings();
      await saveMappings(cur.filter((x) => x.id !== m.id));
      renderList();
    });
    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(del);
    els.list.appendChild(row);
  }
}

renderShortcut();
renderList();
