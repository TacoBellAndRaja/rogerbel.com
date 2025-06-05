// ------------------------------------------------
// Configuration Data (initial defaults)
// ------------------------------------------------
let config = {
  enterprisePriorities: [
    { id: "EP1", name: "Enterprise Priority 1" },
    { id: "EP2", name: "Enterprise Priority 2" },
    { id: "EP3", name: "Enterprise Priority 3" }
    // (… your actual EPs go here)
  ],
  areasOfFocus: [
    { id: "AOF1", name: "Lorem ipsum dolor sit amet", ep: "EP1" },
    { id: "AOF2", name: "Consectetur adipiscing elit", ep: "EP1" },
    { id: "AOF3", name: "Sed do eiusmod tempor", ep: "EP2" }
    // (… your actual AOFs go here)
  ],
  assets: [
    {
      aof: "AOF1",
      name: "Asset 1A",
      owner: "Alice",
      start: "2025-01-01",
      end: "2025-06-30",
      spent: 50000,
      budget: 100000,
      completedPoints: 40,
      totalPoints: 100,
      details: "Asset 1A is on track."
    }
    // (… your actual assets go here)
  ],
  companyMission: "",   // will be populated from spreadsheet
  teamMission: ""       // will be populated from spreadsheet
};

let searchTerm = "";
let selectedOwners = [];
let isSample = true; // true until a file is uploaded

// ------------------------------------------------
// Utility Functions
// ------------------------------------------------
function daysBetween(date1, date2) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((date2 - date1) / msPerDay);
}

function parseDateField(value) {
  if (!value) return "";
  if (typeof value === "number") {
    // Excel stores dates as numbers since 1900; use SheetJS to decode
    const dt = XLSX.SSF.parse_date_code(value);
    return `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}`;
  }
  return value.toString().trim();
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

function matchesSearch(asset) {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    asset.name.toLowerCase().includes(term) ||
    (asset.owner && asset.owner.toLowerCase().includes(term)) ||
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
  const totalBudgetAll = filteredAssets.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);

  // EP-level summary: count assets + sum budgets per EP
  const epSummary = {};
  config.enterprisePriorities.forEach(ep => {
    const aofs = config.areasOfFocus.filter(aof => aof.ep === ep.id).map(a => a.id);
    const assetsEp = filteredAssets.filter(a => aofs.includes(a.aof));
    const countEp = assetsEp.length;
    const sumBe = assetsEp.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    epSummary[ep.id] = { count: countEp, budget: sumBe };
  });

  // AOF-level summary: count + sum budgets per AOF
  const aofSummary = {};
  config.areasOfFocus.forEach(aof => {
    const assetsA = filteredAssets.filter(a => a.aof === aof.id);
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

  const companyRow = document.getElementById("companyMissionRow");
  const teamRow = document.getElementById("teamMissionRow");
  const epRow = document.getElementById("epRow");
  const epSummaryRow = document.getElementById("epSummaryRow");
  const aofRow = document.getElementById("aofRow");
  const aofSummaryRow = document.getElementById("aofSummaryRow");
  const assetsGrid = document.getElementById("assetsGrid");

  // If not sample, show company/team mission; otherwise empty
  companyRow.textContent = isSample ? "" : config.companyMission;
  teamRow.textContent = isSample ? "" : config.teamMission;

  // Filter assets by search + owner
  const filteredAssets = config.assets.filter(
    asset => matchesSearch(asset) && matchesOwner(asset)
  );

  // Compute summaries
  const { totalBudgetAll, epSummary, aofSummary } = computeSummaries(filteredAssets);

  // Populate Owner dropdown
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
    if (selectedOwners.includes(owner)) checkbox.checked = true;
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
    const textNode = document.createTextNode("  " + owner);
    label.appendChild(textNode);
    ownerOptionsContainer.appendChild(label);
  });

  // ----------------------------------------------------
  // 1) Build a “sortedAOFs” array grouped by EP order
  // ----------------------------------------------------
  const epOrderMap = {};
  config.enterprisePriorities.forEach((ep, i) => {
    epOrderMap[ep.id] = i;
  });

  // Copy current AOFs, then sort by their EP index (preserving original sub-order)
  const sortedAOFs = [...config.areasOfFocus].sort((a, b) => {
    const aIdx = epOrderMap[a.ep];
    const bIdx = epOrderMap[b.ep];
    if (aIdx !== bIdx) return aIdx - bIdx;
    return 0;
  });

  // Build a lookup from AOF id → column index (0-based) in sortedAOFs
  const aofIndexMap = {};
  sortedAOFs.forEach((aof, idx) => {
    aofIndexMap[aof.id] = idx;
  });

  // ----------------------------------------------------
  // 2) Render AOF row using sortedAOFs
  // ----------------------------------------------------
  aofRow.innerHTML = "";
  sortedAOFs.forEach((aof, idx) => {
    const aofDiv = document.createElement("div");
    aofDiv.className = "aof";
    aofDiv.textContent = aof.name;
    aofDiv.style.gridColumn = `${idx + 1}`;
    aofRow.appendChild(aofDiv);
  });

  // Count AOF columns
  const aofCount = sortedAOFs.length;

  // ----------------------------------------------------
  // 3) Render EP row with contiguous spans over sortedAOFs
  // ----------------------------------------------------
  epRow.innerHTML = "";
  const aofsByEp = {};
  config.enterprisePriorities.forEach(ep => {
    aofsByEp[ep.id] = sortedAOFs.filter(aof => aof.ep === ep.id);
  });

  config.enterprisePriorities.forEach(ep => {
    const allAofs = aofsByEp[ep.id];
    if (!allAofs.length) return;

    const indices = allAofs.map(aof => aofIndexMap[aof.id]);
    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);

    const startCol = minIndex + 1;
    const endCol = maxIndex + 2; // +2 because gridColumn end is exclusive

    const epDiv = document.createElement("div");
    epDiv.className = "ep";
    epDiv.textContent = ep.name;
    epDiv.style.gridColumn = `${startCol} / ${endCol}`;
    epRow.appendChild(epDiv);
  });

  // ----------------------------------------------------
  // 4) Render EP Summary row with same contiguous spans
  // ----------------------------------------------------
  epSummaryRow.innerHTML = "";
  config.enterprisePriorities.forEach(ep => {
    const allAofs = aofsByEp[ep.id];
    if (!allAofs.length) return;

    const indices = allAofs.map(aof => aofIndexMap[aof.id]);
    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);

    const startCol = minIndex + 1;
    const endCol = maxIndex + 2;

    const { count, budget } = epSummary[ep.id];
    const percent = totalBudgetAll ? Math.round((budget / totalBudgetAll) * 100) : 0;

    const epSumDiv = document.createElement("div");
    epSumDiv.className = "ep-summary";
    epSumDiv.style.gridColumn = `${startCol} / ${endCol}`;
    epSumDiv.textContent = `${count} | ${formatBudget(budget)} | ${percent}%`;
    epSummaryRow.appendChild(epSumDiv);
  });

  // ----------------------------------------------------
  // 5) Render AOF Summary row (also uses sortedAOFs)
  // ----------------------------------------------------
  aofSummaryRow.innerHTML = "";
  sortedAOFs.forEach((aof, idx) => {
    const summary = aofSummary[aof.id];
    const countA = summary.count;
    const budgetA = summary.budget;
    const percentA = totalBudgetAll ? Math.round((budgetA / totalBudgetAll) * 100) : 0;

    const aofSumDiv = document.createElement("div");
    aofSumDiv.className = "aof-summary";
    aofSumDiv.style.gridColumn = `${idx + 1}`;
    aofSumDiv.textContent = `${countA} | ${formatBudget(budgetA)} | ${percentA}%`;
    aofSummaryRow.appendChild(aofSumDiv);
  });

  // ----------------------------------------------------
  // 6) Apply grid-template-columns for everything
  // ----------------------------------------------------
  const gridCols = `repeat(${aofCount}, minmax(0,1fr))`;
  epRow.style.gridTemplateColumns = gridCols;
  epSummaryRow.style.gridTemplateColumns = gridCols;
  aofRow.style.gridTemplateColumns = gridCols;
  aofSummaryRow.style.gridTemplateColumns = gridCols;
  assetsGrid.style.gridTemplateColumns = gridCols;

  // ----------------------------------------------------
  // 7) Render Asset Columns underneath sortedAOFs
  // ----------------------------------------------------
  assetsGrid.innerHTML = "";
  sortedAOFs.forEach(aof => {
    const colDiv = document.createElement("div");
    colDiv.className = "asset-col";

    const assets = filteredAssets
      .filter(asset => asset.aof === aof.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    assets.forEach(asset => {
      const percs = calculatePercentages(asset);

      const card = document.createElement("div");
      card.className = "asset-card";
      card.dataset.assetId = asset.name;
      if (asset.name === selectedAssetId) card.classList.add("selected");

      // Asset header + owner
      const header = document.createElement("div");
      header.className = "asset-header";
      header.textContent = asset.name;
      const ownerSpan = document.createElement("div");
      ownerSpan.className = "asset-owner";
      ownerSpan.textContent = `Owner: ${asset.owner}`;
      card.appendChild(header);
      card.appendChild(ownerSpan);

      // Three status bars:

      // Time
      const timeBar = document.createElement("div");
      timeBar.className = "status-bar";
      const timeFill = document.createElement("div");
      timeFill.className = "status-fill time-fill";
      timeFill.style.width = percs.time + "%";
      timeFill.textContent = percs.time + "%";
      timeBar.appendChild(timeFill);
      card.appendChild(timeBar);

      // Budget
      const budgetBar = document.createElement("div");
      budgetBar.className = "status-bar";
      const budgetFill = document.createElement("div");
      budgetFill.className = "status-fill budget-fill";
      budgetFill.style.width = percs.budget + "%";
      budgetFill.textContent = percs.budget + "%";
      budgetBar.appendChild(budgetFill);
      card.appendChild(budgetBar);

      // Scope
      const scopeBar = document.createElement("div");
      scopeBar.className = "status-bar";
      const scopeFill = document.createElement("div");
      scopeFill.className = "status-fill scope-fill";
      scopeFill.style.width = percs.scope + "%";
      scopeFill.textContent = percs.scope + "%";
      scopeBar.appendChild(scopeFill);
      card.appendChild(scopeBar);

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
  if (!asset) return; // safety guard

  const bladeBody = document.getElementById("bladeBody");
  bladeBody.innerHTML = `
    <h2>${asset.name}</h2>
    <p><strong>Owner:</strong> ${asset.owner}</p>
    <p><strong>Start Date:</strong> ${asset.start}</p>
    <p><strong>ART Approval:</strong> ${asset.ARTApprovalDate || ""}</p>
    <p><strong>SteerCo Approval:</strong> ${asset.SteerCoApprovalDate || ""}</p>
    <p><strong>Total Est. Cost:</strong> $${(asset.budget || 0).toLocaleString()}</p>
    <p><strong>Scope:</strong> ${asset.completedPoints || 0} / ${
    asset.totalPoints || 0
  } story points</p>
    <hr>
    <p><strong>Initiative:</strong> ${asset.initiative || ""}</p>
    <p><strong>Pillar:</strong> ${asset.pillar || ""}</p>
    <p><strong>TPM:</strong> ${asset.tpm || ""}</p>
    <p><strong>Status:</strong> ${asset.status || ""}</p>
    <hr>
    <p>${asset.details || ""}</p>
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
  if (!button.contains(event.target) && !menu.contains(event.target)) {
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
// Copy Headers to Clipboard (for overlay)
function copyHeaders() {
  const headerString = [
    "CompanyMission",
    "TeamMission",
    "EnterprisePriority",
    "AreaOfFocus",
    "AssetMPOID",
    "AssetName",
    "StartDate",
    "LaunchDate",
    "ARTApprovalDate",
    "SteerCoApprovalDate",
    "Owner",
    "TotalEstimatedCost",
    "CompletedPoints",
    "ScopePoints",
    "Description",
    "Pillar",
    "TPM",
    "Status"
  ].join("\t");
  navigator.clipboard.writeText(headerString).then(() => {
    alert("Headers copied to clipboard!");
  }).catch(() => {
    alert("Failed to copy. You can manually select and copy the text.");
  });
}

// ------------------------------------------------
// Excel Upload Handling (with sample‐mode toggle)
// ------------------------------------------------
function parseExcelFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    // Required columns (in any order)
    const requiredCols = [
      "CompanyMission",
      "TeamMission",
      "EnterprisePriority",
      "AreaOfFocus",
      "AssetMPOID",
      "AssetName"
      // …remaining columns omitted for brevity
    ];
    const headerKeys = Object.keys(jsonData[0] || {});
    const missing = requiredCols.filter(col => !headerKeys.includes(col));
    if (missing.length) {
      alert("Missing required columns: " + missing.join(", "));
      return;
    }

    // Grab CompanyMission & TeamMission from the first data row
    config.companyMission = jsonData[0].CompanyMission.toString().trim();
    config.teamMission = jsonData[0].TeamMission.toString().trim();

    const epSet = new Set();
    const aofToEpMap = {};
    const warnings = [];
    const errors = [];

    jsonData.forEach((row, idx) => {
      const rowNum = idx + 2;
      const epVal = row.EnterprisePriority.toString().trim();
      const aofVal = row.AreaOfFocus.toString().trim();
      const assetNameVal = row.AssetName.toString().trim();
      const assetMpoVal = row.AssetMPOID.toString().trim();

      if (!epVal) errors.push(`Row ${rowNum}: EnterprisePriority empty.`);
      if (!aofVal) errors.push(`Row ${rowNum}: AreaOfFocus empty.`);
      if (!assetNameVal) errors.push(`Row ${rowNum}: AssetName empty.`);
      if (!assetMpoVal) errors.push(`Row ${rowNum}: AssetMPOID empty.`);
      if (epVal.length > 50) warnings.push(`Row ${rowNum}: EP too long (${epVal.length}).`);
      if (aofVal.length > 50) warnings.push(`Row ${rowNum}: AOF too long (${aofVal.length}).`);

      epSet.add(epVal);
      if (aofToEpMap[aofVal] === undefined) {
        aofToEpMap[aofVal] = epVal;
      } else if (aofToEpMap[aofVal] !== epVal) {
        errors.push(`Row ${rowNum}: AOF "${aofVal}" under multiple EPs.`);
      }

      row.EnterprisePriority = epVal;
      row.AreaOfFocus = aofVal;
      row.AssetName = assetNameVal;
      row.AssetMPOID = assetMpoVal;
    });

    if (errors.length) {
      alert("Errors:\n" + errors.map(msg => "- " + msg).join("\n"));
      return;
    }
    if (warnings.length) {
      console.warn("Warnings:\n" + warnings.join("\n"));
    }

    const aofSet = new Set();
    jsonData.forEach(row => {
      aofSet.add(row.AreaOfFocus + "||" + row.EnterprisePriority);
    });

    const newEPs = Array.from(epSet).map(id => ({ id: id, name: id }));
    const newAOFs = Array.from(aofSet).map(key => {
      const [aofId, epId] = key.split("||");
      return { id: aofId, name: aofId, ep: epId };
    });

    const newAssets = jsonData.map(row => {
      const startVal = parseDateField(row.StartDate);
      const launchVal = parseDateField(row.LaunchDate);
      const endVal = launchVal || startVal;
      const artDate = parseDateField(row.ARTApprovalDate);
      const steerCoDate = parseDateField(row.SteerCoApprovalDate);

      const initiativeVal = row.Initiative ? row.Initiative.toString().trim() : "";
      const ownerVal = row.Owner ? row.Owner.toString().trim() : "";
      const descVal = row.Description ? row.Description.toString().trim() : "";
      const pillarVal = row.Pillar ? row.Pillar.toString().trim() : "";
      const tpmVal = row.TPM ? row.TPM.toString().trim() : "";
      const statusVal = row.Status ? row.Status.toString().trim() : "";

      let budgetVal = Number(row.TotalEstimatedCost);
      if (isNaN(budgetVal)) {
        budgetVal = 0;
      }
      let completedPtsVal = Number(row.CompletedPoints);
      if (isNaN(completedPtsVal)) completedPtsVal = 0;
      let totalPtsVal = Number(row.ScopePoints);
      if (isNaN(totalPtsVal)) totalPtsVal = 0;

      return {
        aof: row.AreaOfFocus,
        name: row.AssetName,
        mpoid: row.AssetMPOID,
        initiative: initiativeVal,
        owner: ownerVal,
        start: startVal || "",
        end: endVal || "",
        ARTApprovalDate: artDate || "",
        SteerCoApprovalDate: steerCoDate || "",
        spent: 0,
        budget: budgetVal,
        completedPoints: completedPtsVal,
        totalPoints: totalPtsVal,
        details: descVal,
        pillar: pillarVal,
        tpm: tpmVal,
        status: statusVal
      };
    });

    // Switch out the config arrays
    config = {
      enterprisePriorities: newEPs,
      areasOfFocus: newAOFs,
      assets: newAssets,
      companyMission: config.companyMission,
      teamMission: config.teamMission
    };

    // Remove “sample mode” styling & overlay
    if (isSample) {
      isSample = false;
      document.body.classList.remove("sample-mode");
      document.getElementById("overlay").style.display = "none";
    }

    // Reset owner filter UI
    selectedOwners = [];
    document.getElementById("ownerSelectAll").checked = false;
    updateOwnerButtonLabel();

    render();
  };

  reader.readAsArrayBuffer(file);
}

// ------------------------------------------------
// Search & Initialization
// ------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  // Initially enter “sample mode”
  document.body.classList.add("sample-mode");
  render();

  // Hook up “Copy Headers” button
  document.getElementById("copyHeadersBtn").addEventListener("click", copyHeaders);

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
      checkboxes.forEach((cb) => {
        cb.checked = true;
        selectedOwners.push(cb.value);
      });
    } else {
      checkboxes.forEach((cb) => {
        cb.checked = false;
      });
      selectedOwners = [];
    }
    updateOwnerButtonLabel();
    render();
  });

  // Close dropdown if click outside
  document.addEventListener("click", closeOwnerDropdownOnClickOutside);

  // Upload button → trigger file input
  document.getElementById("uploadButton").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("excelInput").click();
  });

  // File input change → parse Excel
  document.getElementById("excelInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) parseExcelFile(file);
    e.target.value = "";
  });

  // Window resize for font sizing
  window.addEventListener("resize", updateHeadingFontSizes);
});
