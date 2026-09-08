"use strict";

chrome.storage.local.get("mappings", (data) => {
  const list = Array.isArray(data.mappings) ? data.mappings : [];
  document.getElementById("count").textContent = list.length;
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
