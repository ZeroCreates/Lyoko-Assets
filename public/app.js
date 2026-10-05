const grid = document.querySelector("#asset-grid");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const addAssetsButton = document.querySelector("#add-assets");
const uploadInput = document.querySelector("#upload-input");
const toast = document.querySelector("#toast");

let assets = [];
let activeFilter = "all";
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function getVariant(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("human")) return "human";
  if (normalized.includes("xana")) return "xana";
  if (normalized.includes("normal")) return "normal";
  return "standard";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function makeAssetCard(asset, index) {
  const variant = getVariant(asset.name);
  const card = document.createElement("article");
  card.className = "asset-card";
  card.style.setProperty("--card-order", index);

  const preview = document.createElement("a");
  preview.className = "asset-preview";
  preview.href = asset.url;
  preview.target = "_blank";
  preview.rel = "noreferrer";
  preview.setAttribute("aria-label", `Open ${asset.name}`);

  const image = document.createElement("img");
  image.src = asset.url;
  image.alt = asset.name;
  image.loading = "lazy";
  preview.append(image);

  const previewTag = document.createElement("span");
  previewTag.className = `preview-tag tag-${variant}`;
  previewTag.textContent = variant;
  preview.append(previewTag);

  const details = document.createElement("div");
  details.className = "asset-details";

  const name = document.createElement("h2");
  name.className = "asset-name";
  name.textContent = asset.name;

  const metadata = document.createElement("div");
  metadata.className = "asset-meta";
  const format = document.createElement("span");
  format.textContent = asset.extension;
  const separator = document.createElement("span");
  separator.className = "meta-separator";
  separator.textContent = "/";
  const size = document.createElement("span");
  size.textContent = formatSize(asset.size);
  const idButton = document.createElement("button");
  idButton.className = "asset-id-button";
  idButton.type = "button";
  idButton.textContent = `ID ${asset.id}`;
  idButton.title = "Copy asset ID";
  idButton.setAttribute("aria-label", `Copy ID ${asset.id}`);
  idButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(asset.id);
      showToast(`ID ${asset.id} copied`);
    } catch {
      showToast("Could not copy ID");
    }
  });
  metadata.append(idButton, separator, format, separator.cloneNode(true), size);

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", `Copy link to ${asset.name}`);
  copyButton.title = "Copy asset link";
  copyButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 6.5V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H13M5.5 7h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/></svg>';
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(asset.url);
      showToast("Asset link copied");
    } catch {
      showToast("Could not copy link");
    }
  });

  details.append(name, metadata, copyButton);
  card.append(preview, details);
  return card;
}

function renderAssets() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleAssets = assets.filter((asset) => {
    const matchesFilter = activeFilter === "all" || getVariant(asset.name) === activeFilter;
    return matchesFilter && asset.name.toLowerCase().includes(query);
  });

  grid.replaceChildren(...visibleAssets.map(makeAssetCard));
  emptyState.hidden = visibleAssets.length > 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderAssets();
  });
});

searchInput.addEventListener("input", renderAssets);
addAssetsButton.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", async () => {
  const files = [...uploadInput.files];
  if (files.length === 0) return;

  const buttonLabel = addAssetsButton.querySelector("span");
  addAssetsButton.disabled = true;
  buttonLabel.textContent = "Adding...";

  let addedCount = 0;
  let failedCount = 0;
  try {
    for (const file of files) {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (response.ok) {
        addedCount += 1;
      } else {
        failedCount += 1;
      }
    }
    await loadAssets();
    showToast(failedCount ? `${addedCount} added, ${failedCount} failed` : `${addedCount} asset${addedCount === 1 ? "" : "s"} added`);
  } catch {
    showToast("Upload failed. Check the server and try again.");
  } finally {
    uploadInput.value = "";
    addAssetsButton.disabled = false;
    buttonLabel.textContent = "Add assets";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    searchInput.blur();
    renderAssets();
  }
});

async function loadAssets() {
  try {
    const response = await fetch("/api/links");
    if (!response.ok) throw new Error("The link provider returned an error.");
    const data = await response.json();
    assets = data.assets;
    document.querySelector("#total-count").textContent = String(assets.length).padStart(2, "0");
    document.querySelector("#heading-count").textContent = String(assets.length).padStart(2, "0");
    renderAssets();
  } catch {
    grid.innerHTML = '<div class="loading-state error-state">Could not load assets. Check that the server is running.</div>';
  }
}

loadAssets();