"use strict";

const STORAGE_KEY = "mappings";

const state = {
  image: null,
};

const els = {
  name: document.getElementById("nameInput"),
  trigger: document.getElementById("triggerInput"),
  text: document.getElementById("textInput"),
  textWrap: document.getElementById("textWrap"),
  imageWrap: document.getElementById("imageWrap"),
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

function renderType() {
  const isText = document.querySelector("input[name='type']:checked").value === "text";
  els.textWrap.style.display = isText ? "block" : "none";
  els.imageWrap.style.display = isText ? "none" : "block";
}

document.querySelectorAll("input[name='type']").forEach((radio) => {
  radio.addEventListener("change", renderType);
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

els.saveBtn.addEventListener("click", async () => {
  const trigger = els.trigger.value.trim();
  const type = document.querySelector("input[name='type']:checked").value;
  if (!trigger) {
    showStatus("Chưa nhập mã gõ.", true);
    return;
  }
  if (type === "text" && !els.text.value) {
    showStatus("Chưa nhập nội dung văn bản.", true);
    return;
  }
  if (type === "image" && !state.image) {
    showStatus("Chưa chọn ảnh.", true);
    return;
  }
  const list = await loadMappings();
  if (trigger && list.some((m) => (m.trigger || "").toLowerCase() === trigger.toLowerCase())) {
    showStatus("Mã gõ này đã được dùng.", true);
    return;
  }
  list.push({
    id: crypto.randomUUID(),
    name: els.name.value.trim() || (state.image && state.image.fileName) || trigger,
    type,
    trigger,
    text: type === "text" ? els.text.value : "",
    image: type === "image" ? state.image : null,
    createdAt: Date.now(),
  });
  try {
    await saveMappings(list);
  } catch (err) {
    showStatus("Lưu thất bại (có thể ảnh quá lớn): " + err.message, true);
    return;
  }
  els.name.value = "";
  els.trigger.value = "";
  els.text.value = "";
  document.querySelector("input[name='type'][value='image']").checked = true;
  state.image = null;
  els.fileInput.value = "";
  els.preview.src = "";
  els.previewWrap.style.display = "none";
  renderType();
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
    if (m.image) img.src = m.image.dataUrl;
    else img.style.visibility = "hidden";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = m.name;
    const kbd = document.createElement("div");
    const span = document.createElement("span");
    span.className = "kbd";
    span.textContent = m.trigger || "Mã cũ";
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

renderType();
renderList();
