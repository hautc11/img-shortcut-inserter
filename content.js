"use strict";

(() => {
  const STORAGE_KEY = "mappings";
  let mappings = [];
  let typedBuffer = "";

  function loadMappings() {
    try {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        mappings = Array.isArray(data && data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
      });
    } catch (_) {
      mappings = [];
    }
  }

  loadMappings();

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        mappings = Array.isArray(changes[STORAGE_KEY].newValue)
          ? changes[STORAGE_KEY].newValue
          : [];
      }
    });
  } catch (_) {}

  function dataUrlToBlob(dataUrl) {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function blobToPngBlob(blob) {
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png"
      )
    );
  }

  async function copyImageToClipboard(dataUrl) {
    if (!navigator.clipboard || !window.ClipboardItem) return false;
    try {
      const blob = dataUrlToBlob(dataUrl);
      const pngBlob = await blobToPngBlob(blob);
      const item = new ClipboardItem({ "image/png": pngBlob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      return false;
    }
  }

  function getEditableTarget() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    if (!el) return null;
    if (el.tagName === "IFRAME") {
      try {
        const doc = el.contentDocument;
        if (doc) return doc.activeElement || doc.body;
      } catch (_) {
        return null;
      }
    }
    return el;
  }

  function isPlainInput(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "url", "email", "tel", "password"].includes(t);
    }
    return false;
  }

  function isRichEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    let p = el;
    while (p) {
      if (p.isContentEditable) return true;
      p = p.parentElement;
    }
    return false;
  }

  function isEditable(el) {
    return isPlainInput(el) || isRichEditable(el);
  }

  function deletePreviousCharacters(target, count) {
    if (isPlainInput(target)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start === null || end === null || start !== end || start < count) return false;
      target.setRangeText("", start - count, end, "end");
      return true;
    }
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed || !sel.modify) return false;
    for (let i = 0; i < count; i++) sel.modify("extend", "backward", "character");
    if (sel.toString().length !== count) return false;
    sel.deleteFromDocument();
    return true;
  }

  function insertText(target, text) {
    if (isPlainInput(target)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start === null || end === null) return false;
      target.setRangeText(text, start, end, "end");
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return true;
    }
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = doc.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  function findTypedMapping(target) {
    if (!typedBuffer) return null;
    const match = mappings.find((m) => m.trigger && m.trigger.toLowerCase() === typedBuffer.toLowerCase());
    if (!match || !isEditable(target)) return null;
    return match;
  }

  const CLIPBOARD_FIRST_HOSTS = [
    "teams.microsoft.com",
    "teams.live.com",
    "docs.google.com",
    "outlook.office.com",
    "outlook.office365.com",
    "outlook.live.com",
  ];

  function isClipboardFirstHost() {
    const h = location.hostname || "";
    return CLIPBOARD_FIRST_HOSTS.some((d) => h === d || h.endsWith("." + d));
  }

  function trySyntheticPaste(target, dataUrl, mimeType) {
    try {
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], "image." + (mimeType.split("/")[1] || "png"), {
        type: mimeType,
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      const pasteEvt = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      try {
        Object.defineProperty(pasteEvt, "clipboardData", { value: dt });
      } catch (_) {}
      target.dispatchEvent(pasteEvt);
      return pasteEvt.defaultPrevented;
    } catch (_) {
      return false;
    }
  }

  function tryInsertHTML(target, dataUrl) {
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;
    try {
      const sel = win.getSelection();
      if (sel && sel.rangeCount === 0 && target.isContentEditable) {
        const r = doc.createRange();
        r.selectNodeContents(target);
        r.collapse(false);
        sel.addRange(r);
      }
      return doc.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="">`);
    } catch (_) {
      return false;
    }
  }

  function notify(msg, isError) {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "right:20px",
      "z-index:2147483647",
      "padding:8px 14px",
      "border-radius:6px",
      "font:13px -apple-system,BlinkMacSystemFont,sans-serif",
      "background:" + (isError ? "#c53030" : "#2b6cb0"),
      "color:#fff",
      "box-shadow:0 2px 8px rgba(0,0,0,0.2)",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 0.15s",
      "max-width:320px",
    ].join(";");
    document.documentElement.appendChild(n);
    requestAnimationFrame(() => (n.style.opacity = "1"));
    setTimeout(() => {
      n.style.opacity = "0";
      setTimeout(() => n.remove(), 200);
    }, 2200);
  }

  async function handleTrigger(mapping) {
    const target = getEditableTarget();
    if (!target) return;

    if (mapping.type === "text") {
      if (!isEditable(target)) return;
      if (mapping.trigger && !deletePreviousCharacters(target, mapping.trigger.length)) return;
      insertText(target, mapping.text || "");
      return;
    }

    if (isPlainInput(target)) {
      notify("Ô này là input/textarea thuần, không nhận được ảnh.", true);
      return;
    }
    if (!isRichEditable(target)) return;

    const { dataUrl, mimeType } = mapping.image;
    const clipboardFirst = isClipboardFirstHost();
    const isMac = /Mac/i.test(navigator.platform);
    const pasteKey = isMac ? "Cmd+V" : "Ctrl+V";

    if (clipboardFirst) {
      const ok = await copyImageToClipboard(dataUrl);
      if (ok) notify(`Đã sao chép ảnh — nhấn ${pasteKey} để dán.`);
      else notify("Không sao chép được ảnh vào clipboard.", true);
      return;
    }

    if (mapping.trigger && !deletePreviousCharacters(target, mapping.trigger.length)) return;
    if (trySyntheticPaste(target, dataUrl, mimeType)) return;
    if (tryInsertHTML(target, dataUrl)) return;

    const ok = await copyImageToClipboard(dataUrl);
    if (ok) notify(`Editor này không nhận chèn trực tiếp — đã copy, nhấn ${pasteKey}.`);
    else notify("Không chèn được ảnh vào editor này.", true);
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (!mappings.length) return;
      const target = getEditableTarget();
      if (!target) return;

      if (e.ctrlKey || e.altKey || e.metaKey) {
        typedBuffer = "";
        return;
      }

      if (e.key.length === 1) {
        typedBuffer += e.key;
        if (typedBuffer.length > 80) typedBuffer = typedBuffer.slice(-80);
        return;
      }

      if (e.key !== "Tab") {
        typedBuffer = "";
        return;
      }

      const typedMapping = findTypedMapping(target);
      typedBuffer = "";
      if (!typedMapping) return;

      e.preventDefault();
      e.stopPropagation();
      handleTrigger(typedMapping);
    },
    true
  );
})();
