// ------------------------------------------------
// Configuration Data (initial defaults)
// ------------------------------------------------
let config = {
  enterprisePriorities: [
    { id: "EP1", name: "Enterprise Priority 1" },
    { id: "EP2", name: "Enterprise Priority 2" },
    { id: "EP3", name: "Enterprise Priority 3" },
    { id: "EP4", name: "Enterprise Priority 4" },
    { id: "EP5", name: "Enterprise Priority 5" }
  ],
  areasOfFocus: [
    { id: "AOF1", name: "Lorem ipsum dolor sit amet", ep: "EP1" },
    { id: "AOF2", name: "Consectetur adipiscing elit", ep: "EP1" },
    { id: "AOF3", name: "Sed do eiusmod tempor", ep: "EP2" },
    { id: "AOF4", name: "Incididunt ut labore et dolore", ep: "EP3" },
    { id: "AOF5", name: "Magna aliqua quis nostrud", ep: "EP3" },
    { id: "AOF6", name: "Exercitation ullamco laboris nisi", ep: "EP4" },
    { id: "AOF7", name: "Ut aliquip ex ea commodo consequat", ep: "EP5" }
  ],
  assets: [
    { aof: "AOF1", name: "Asset 1A", owner: "Alice", start: "2025-01-01", end:   "2025-06-30", spent: 50000, budget: 100000, completedPoints: 40, totalPoints: 100, details: "Asset 1A is on track." },
    { aof: "AOF1", name: "Asset 1B", owner: "Bob",   start: "2025-03-01", end:   "2025-09-30", spent: 70000, budget: 70000,  completedPoints: 80, totalPoints: 100, details: "Asset 1B has spent its budget and is nearing completion." },
    { aof: "AOF2", name: "Asset 2A", owner: "Carol", start: "2025-02-15", end:   "2025-05-15", spent: 30000, budget: 50000,  completedPoints: 60, totalPoints: 100, details: "Asset 2A progressed smoothly; pending final review." },
    { aof: "AOF3", name: "Asset 3A", owner: "David", start: "2025-01-20", end:   "2025-04-20", spent: 45000, budget: 60000,  completedPoints: 50, totalPoints: 100, details: "Asset 3A is midway; facing minor scope adjustments." },
    { aof: "AOF4", name: "Asset 4A", owner: "Eve",   start: "2025-04-01", end:   "2025-10-01", spent: 20000, budget: 80000,  completedPoints: 20, totalPoints: 100, details: "Asset 4A kicked off recently; still early phases." },
    { aof: "AOF4", name: "Asset 4B", owner: "Frank", start: "2025-02-01", end:   "2025-08-01", spent: 60000, budget: 90000,  completedPoints: 70, totalPoints: 100, details: "Asset 4B is high priority and well on schedule." },
    { aof: "AOF5", name: "Asset 5A", owner: "Grace", start: "2025-03-10", end:   "2025-07-10", spent: 30000, budget: 40000,  completedPoints: 30, totalPoints: 100, details: "Asset 5A facing some delays due to resource constraints." },
    { aof: "AOF6", name: "Asset 6A", owner: "Heidi", start: "2025-01-05", end:   "2025-12-31", spent: 100000, budget: 150000, completedPoints: 50, totalPoints: 100, details: "Asset 6A is a long-term initiative; steady progress reported." },
    { aof: "AOF7", name: "Asset 7A", owner: "Ivan",  start: "2025-05-01", end:   "2025-09-30", spent: 20000, budget: 50000,  completedPoints: 20, totalPoints: 100, details: "Asset 7A just started; planning stages underway." }
  ]
};

let searchTerm = "";
let selectedOwners = [];

// ------------------------------------------------
// Utility Functions
// ------------------------------------------------
function daysBetween(date1, date2) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((date2 - date1) / msPerDay);
}

function calculatePercentages(asset) {
  const today = new Date();
  const startDate = new Date(asset.start);
  const endDate = new Date(asset.end);
  const totalDays = daysBetween(startDate, endDate);
  const elapsedDays = daysBetween(startDate, today);
  const percentTime = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100);
  const percentBudget = Math.min((asset.spent / asset.budget) * 100, 100);
  const percentScope = Math.min((asset.completedPoints / asset.totalPoints) * 100, 100);
  return {
    time: Math.round(percentTime),
    budget: Math.round(percentBudget),
    scope: Math.round(percentScope)
  };
}

function getStatusColorClass(percs) {
  const values = [percs.time, percs.budget, percs.scope];
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const diff = maxVal - minVal;
  if (diff <= 10) return "status-safe";
  if (diff <= 20) return "status-caution";
  if (diff <= 30) return "status-warning";
  return "status-danger";
}

function matchesSearch(asset) {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    asset.name.toLowerCase().includes(term) ||
    asset.owner.toLowerCase().includes(term) ||
    (asset.details && asset.details.toLowerCase().includes(term))
  );
}

function matchesOwner(asset) {
  if (!selectedOwners.length) return true;
  return selectedOwners.includes(asset.owner);
}

function formatBudget(amount) {
  amount = Number(amount) || 0;
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

// ------------------------------------------------
// Compute Summaries
// ------------------------------------------------
function computeSummaries(filteredAssets) {
  const filtered = filteredAssets;
  const totalBudgetAll = filtered.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);

  // EP-level summary: count assets + sum budgets per EP
  const epSummary = {};
  config.enterprisePriorities.forEach(ep => {
    const aofs = config.areasOfFocus.filter(aof => aof.ep === ep.id).map(a => a.id);
    const assetsEp = filtered.filter(a => aofs.includes(a.aof));
    const countEp = assetsEp.length;
    const sumBe = assetsEp.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    epSummary[ep.id] = { count: countEp, budget: sumBe };
  });

  // AOF-level summary: count + sum budgets per AOF
  const aofSummary = {};
  config.areasOfFocus.forEach(aof => {
    const assetsA = filtered.filter(a => a.aof === aof.id);
    const countA = assetsA.length;
    const sumBa = assetsA.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    aofSummary[aof.id] = { count: countA, budget: sumBa };
  });

  return { totalBudgetAll, epSummary, aofSummary };
}

// ------------------------------------------------
// Font Resize Based on assetsArea Width
// ------------------------------------------------
function updateHeadingFontSizes() {
  const assetsArea = document.getElementById("assetsArea");
  const width = assetsArea.clientWidth;
  let epSize = width / 80;
  let aofSize = width / 90;
  let sumSize = width / 100;
  epSize = Math.min(Math.max(epSize, 12), 20);
  aofSize = Math.min(Math.max(aofSize, 10), 18);
  sumSize = Math.min(Math.max(sumSize, 10), 14);
  document.documentElement.style.setProperty("--ep-font-size", epSize + "px");
  document.documentElement.style.setProperty("--aof-font-size", aofSize + "px");
  document.documentElement.style.setProperty("--summary-font-size", sumSize + "px");
}

// ------------------------------------------------
// Render Functions
// ------------------------------------------------
let selectedAssetId = null;

function render() {
  updateHeadingFontSizes();
  const epRow = document.getElementById("epRow");
  const aofRow = document.getElementById("aofRow");
  const epSummaryRow = document.getElementById("epSummaryRow");
  const aofSummaryRow = document.getElementById("aofSummaryRow");
  const assetsGrid = document.getElementById("assetsGrid");

  // Filter assets by search and owner
  const filteredAssets = config.assets.filter(
    asset => matchesSearch(asset) && matchesOwner(asset)
  );

  // Compute summaries
  const { totalBudgetAll, epSummary, aofSummary } = computeSummaries(filteredAssets);

  // Populate owner dropdown options (checkbox list) from ALL assets (not just filtered)
  const ownerSet = Array.from(new Set(config.assets.map(a => a.owner))).sort();
  const ownerOptionsContainer = document.getElementById("ownerOptions");
  ownerOptionsContainer.innerHTML = "";
  ownerSet.forEach(owner => {
    const label = document.createElement("label");
    label.className = "dropdown-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = owner;
    checkbox.className = "owner-checkbox";
    if (selectedOwners.includes(owner)) {
      checkbox.checked = true;
    }
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedOwners.push(owner);
      } else {
        const idx = selectedOwners.indexOf(owner);
        if (idx !== -1) selectedOwners.splice(idx, 1);
      }
      updateOwnerButtonLabel();
      render();
    });
    label.appendChild(checkbox);
    const text = document.createTextNode("  " + owner);
    label.appendChild(text);
    ownerOptionsContainer.appendChild(label);
  });

  // EP/AOF grouping
  const aofsByEp = {};
  config.enterprisePriorities.forEach(ep => {
    aofsByEp[ep.id] = config.areasOfFocus.filter(aof => aof.ep === ep.id);
  });

  // Total columns
  const totalAOFs = config.areasOfFocus.length;
  const gridCols = `repeat(${totalAOFs}, 1fr)`;

  epRow.style.gridTemplateColumns = gridCols;
  aofRow.style.gridTemplateColumns = gridCols;
  epSummaryRow.style.gridTemplateColumns = gridCols;
  aofSummaryRow.style.gridTemplateColumns = gridCols;
  assetsGrid.style.gridTemplateColumns = gridCols;

  // Clear previous
  epSummaryRow.innerHTML = "";
  epRow.innerHTML = "";
  aofSummaryRow.innerHTML = "";
  aofRow.innerHTML = "";
  assetsGrid.innerHTML = "";

  // --- Render EP Row ---
  config.enterprisePriorities.forEach(ep => {
    const aofs = aofsByEp[ep.id];
    const startCol = config.areasOfFocus.findIndex(a => a.id === aofs[0]?.id) + 1;
    const countAofs = aofs.length || 1;
    const endCol = startCol + countAofs;

    const epDiv = document.createElement("div");
    epDiv.className = "ep";
    epDiv.style.gridColumn = `${startCol} / ${endCol}`;
    epDiv.textContent = ep.name;
    epRow.appendChild(epDiv);
  });

  // --- Render EP Summary Row (below EP) ---
  config.enterprisePriorities.forEach(ep => {
    const summary = epSummary[ep.id];
    const count = summary.count;
    const budget = summary.budget;
    const percent = totalBudgetAll ? Math.round((budget / totalBudgetAll) * 100) : 0;

    const aofs = aofsByEp[ep.id];
    const startCol = config.areasOfFocus.findIndex(a => a.id === aofs[0]?.id) + 1;
    const countAofs = aofs.length || 1;
    const endCol = startCol + countAofs;

    const epSumDiv = document.createElement("div");
    epSumDiv.className = "ep-summary";
    epSumDiv.style.gridColumn = `${startCol} / ${endCol}`;
    epSumDiv.textContent = `${count} | ${formatBudget(budget)} | ${percent}%`;
    epSummaryRow.appendChild(epSumDiv);
  });

  // --- Render AOF Row ---
  config.areasOfFocus.forEach((aof, idx) => {
    const aofDiv = document.createElement("div");
    aofDiv.className = "aof";
    aofDiv.style.gridColumn = `${idx + 1}`;
    aofDiv.textContent = aof.name;
    aofRow.appendChild(aofDiv);
  });

  // --- Render AOF Summary Row (below AOF) ---
  config.areasOfFocus.forEach((aof, idx) => {
    const summary = aofSummary[aof.id];
    const count = summary.count;
    const budget = summary.budget;
    const percent = totalBudgetAll ? Math.round((budget / totalBudgetAll) * 100) : 0;

    const aofSumDiv = document.createElement("div");
    aofSumDiv.className = "aof-summary";
    aofSumDiv.style.gridColumn = `${idx + 1}`;
    aofSumDiv.textContent = `${count} | ${formatBudget(budget)} | ${percent}%`;
    aofSummaryRow.appendChild(aofSumDiv);
  });

  // --- Render Asset Columns ---
  config.areasOfFocus.forEach(aof => {
    const colDiv = document.createElement("div");
    colDiv.className = "asset-col";

    const assets = filteredAssets
      .filter(asset => asset.aof === aof.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    assets.forEach(asset => {
      const percs = calculatePercentages(asset);
      const statusClass = getStatusColorClass(percs);

      const statusDot = document.createElement("div");
      statusDot.className = `status-indicator ${statusClass}`;

      const statusBarCon = document.createElement("div");
      statusBarCon.className = "status-bar-container";

      const budgetIcon = document.createElement("span");
      budgetIcon.className = "icon budget";
      budgetIcon.textContent = "💲";
      budgetIcon.style.left = `${percs.budget}%`;
      statusBarCon.appendChild(budgetIcon);

      const timeIcon = document.createElement("span");
      timeIcon.className = "icon time";
      timeIcon.textContent = "⏰";
      timeIcon.style.left = `${percs.time}%`;
      statusBarCon.appendChild(timeIcon);

      const scopeIcon = document.createElement("span");
      scopeIcon.className = "icon scope";
      scopeIcon.textContent = "🔨";
      scopeIcon.style.left = `${percs.scope}%`;
      statusBarCon.appendChild(scopeIcon);

      const card = document.createElement("div");
      card.className = "asset-card";
      card.dataset.assetId = asset.name;
      if (asset.name === selectedAssetId) card.classList.add("selected");
      card.appendChild(statusDot);

      const header = document.createElement("div");
      header.className = "asset-header";
      header.textContent = asset.name;
      const ownerSpan = document.createElement("div");
      ownerSpan.className = "asset-owner";
      ownerSpan.textContent = `Owner: ${asset.owner}`;
      card.appendChild(header);
      card.appendChild(ownerSpan);
      card.appendChild(statusBarCon);

      colDiv.appendChild(card);
    });

    assetsGrid.appendChild(colDiv);
  });

  // Attach click listeners for asset cards
  document.querySelectorAll(".asset-card").forEach(card => {
    card.addEventListener("click", () => {
      selectAsset(card.dataset.assetId);
    });
  });
}

// ------------------------------------------------
// Blade Functions
// ------------------------------------------------
function selectAsset(assetId) {
  selectedAssetId = assetId;
  render();

  const asset = config.assets.find(a => a.name === assetId);
  const bladeBody = document.getElementById("bladeBody");
  bladeBody.innerHTML = `
    <h2>${asset.name}</h2>
    <p><strong>Owner:</strong> ${asset.owner}</p>
    <p><strong>Start:</strong> ${asset.start}</p>
    <p><strong>End:</strong> ${asset.end}</p>
    <p><strong>Spent:</strong> $${(asset.spent || 0).toLocaleString()} / $${(asset.budget||0).toLocaleString()}</p>
    <p><strong>Scope:</strong> ${asset.completedPoints || 0} / ${asset.totalPoints || 0} story points</p>
    <hr>
    <p>${asset.details || ""}</p>
    ${asset.pillar ? `<p><strong>Pillar:</strong> ${asset.pillar}</p>` : ""}
    ${asset.tpm ? `<p><strong>TPM:</strong> ${asset.tpm}</p>` : ""}
    ${asset.status ? `<p><strong>Status:</strong> ${asset.status}</p>` : ""}
  `;

  document.getElementById("blade").classList.add("open");
  document.getElementById("mainContent").classList.add("shifted");
  updateHeadingFontSizes();
}

function closeBlade() {
  document.getElementById("blade").classList.remove("open");
  document.getElementById("mainContent").classList.remove("shifted");
  selectedAssetId = null;
  render();
}

// ------------------------------------------------
// Owner Dropdown Behavior
// ------------------------------------------------
function toggleOwnerDropdown() {
  const menu = document.getElementById("ownerDropdownMenu");
  menu.classList.toggle("open");
}

function closeOwnerDropdownOnClickOutside(event) {
  const button = document.getElementById("ownerDropdownButton");
  const menu = document.getElementById("ownerDropdownMenu");
  if (
    !button.contains(event.target) &&
    !menu.contains(event.target)
  ) {
    menu.classList.remove("open");
  }
}

function updateOwnerButtonLabel() {
  const labelSpan = document.querySelector("#ownerDropdownButton .btn-label");
  if (!selectedOwners.length) {
    labelSpan.textContent = "Owner";
    return;
  }
  if (selectedOwners.length === 1) {
    labelSpan.textContent = selectedOwners[0];
    return;
  }
  labelSpan.textContent = `${selectedOwners.length} Selected`;
}

// ------------------------------------------------
// Excel Upload Handling
// ------------------------------------------------
function parseExcelFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    // Expected columns in Excel:
    //   • EnterprisePriority   (e.g. "EP1")
    //   • AreaOfFocus          (e.g. "AOF3")
    //   • AssetMPOID           (string or number, 1:1 with AssetName)
    //   • AssetName            (string)
    //   • Owner                (string)
    //   • Description          (string)
    //   • Pillar               (string)
    //   • TPM                  (string)
    //   • Status               (string)
    //   • TotalEstimatedCost   (number)
    //   • LaunchDate           (YYYY-MM-DD or Excel date)
    //   • ScopePoints          (number – total)
    //   • CompletedPoints      (number)
    //
    // Validate presence of required columns:
    const requiredCols = ["EnterprisePriority", "AreaOfFocus", "AssetMPOID", "AssetName"];
    const missing = requiredCols.filter(col => !Object.keys(jsonData[0] || {}).includes(col));
    if (missing.length) {
      alert("Missing required columns: " + missing.join(", "));
      return;
    }

    // Build new arrays:
    const epSet = new Set();
    const aofSet = new Set();
    jsonData.forEach(row => {
      epSet.add(row.EnterprisePriority);
      aofSet.add(row.AreaOfFocus + "||" + row.EnterprisePriority); 
      // store "AOF||EP" so we can split later
    });

    // Reconstruct enterprisePriorities
    const newEPs = Array.from(epSet).map(id => ({ id: id, name: id }));
    // Reconstruct areasOfFocus
    const newAOFs = Array.from(aofSet).map(key => {
      const [aofId, epId] = key.split("||");
      return { id: aofId, name: aofId, ep: epId };
    });

    // Reconstruct assets
    const newAssets = jsonData.map(row => {
      // Convert Excel date or string to ISO yyyy-mm-dd
      let launch = "";
      if (row.LaunchDate) {
        if (typeof row.LaunchDate === "number") {
          // Excel stores dates as numbers since 1900; use XLSX to convert
          const dt = XLSX.SSF.parse_date_code(row.LaunchDate);
          launch = `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}`;
        } else if (typeof row.LaunchDate === "string") {
          launch = row.LaunchDate;
        }
      }
      const budgetVal = Number(row.TotalEstimatedCost) || 0;
      const scopeTotal = Number(row.ScopePoints) || 0;
      const scopeDone = Number(row.CompletedPoints) || 0;

      return {
        aof: row.AreaOfFocus,
        name: row.AssetName,
        mpoid: row.AssetMPOID,
        owner: row.Owner || "",
        start: launch || "",
        end: launch || "",        // set same as launch if no explicit end
        spent: 0,                 // default 0 (user can edit later)
        budget: budgetVal,
        completedPoints: scopeDone,
        totalPoints: scopeTotal,
        details: row.Description || "",
        pillar: row.Pillar || "",
        tpm: row.TPM || "",
        status: row.Status || ""
      };
    });

    // Override global config:
    config = {
      enterprisePriorities: newEPs,
      areasOfFocus: newAOFs,
      assets: newAssets
    };

    // Reset owners/filter
    selectedOwners = [];
    document.getElementById("ownerSelectAll").checked = false;
    updateOwnerButtonLabel();

    // Re‐render with new data
    render();
  };

  reader.readAsArrayBuffer(file);
}

// ------------------------------------------------
// Search & Initialization
// ------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  render();

  // Blade close
  document.getElementById("bladeClose").addEventListener("click", closeBlade);

  // Search input
  const searchInput = document.getElementById("assetSearch");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.trim();
    render();
  });

  // Owner dropdown toggle
  document
    .getElementById("ownerDropdownButton")
    .addEventListener("click", toggleOwnerDropdown);

  // Select All checkbox
  document.getElementById("ownerSelectAll").addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll(".owner-checkbox");
    selectedOwners = [];
    if (e.target.checked) {
      checkboxes.forEach(cb => {
        cb.checked = true;
        selectedOwners.push(cb.value);
      });
    } else {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      selectedOwners = [];
    }
    updateOwnerButtonLabel();
    render();
  });

  // Close dropdown if click outside
  document.addEventListener("click", closeOwnerDropdownOnClickOutside);

  // Upload button ⇒ trigger file input
  document.getElementById("uploadButton").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("excelInput").click();
  });

  // File input change ⇒ parse Excel
  document.getElementById("excelInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      parseExcelFile(file);
    }
    // Reset input so same file can be re‐selected if needed
    e.target.value = "";
  });

  // Window resize for font sizing
  window.addEventListener("resize", updateHeadingFontSizes);
});
