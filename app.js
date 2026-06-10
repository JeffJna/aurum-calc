"use strict";

const INITIAL_WEIGHTS = [10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const DEFAULT_STATE = Object.freeze({
  precoOuro: 600,
  maoDeObra: 80,
  percentualPerda: 6,
  percentualLiga: 20,
  tipoCalculo: "A",
  pesos: INITIAL_WEIGHTS
});
const STORAGE_KEY = "aurum-calc-state-v2";
const LEGACY_STORAGE_KEY = "calculadora-joias-ouro-v1";
const THEME_KEY = "aurum-calc-theme";
const MAX_WEIGHTS = 100;
const MAX_WEIGHT = 100000;

function calculateScenarioA(goldPurchased, configuration) {
  const alloyAdded = goldPurchased * configuration.alloy;
  const materialBeforeLoss = goldPurchased + alloyAdded;
  const lossInGrams = materialBeforeLoss * configuration.loss;
  const finalWeight = materialBeforeLoss - lossInGrams;
  const goldCost = goldPurchased * configuration.goldPrice;
  const laborCost = finalWeight * configuration.laborPrice;

  return {
    baseWeight: goldPurchased,
    gold: goldPurchased,
    alloy: alloyAdded,
    material: materialBeforeLoss,
    loss: lossInGrams,
    finalWeight,
    goldCost,
    laborCost,
    finalPrice: goldCost + laborCost
  };
}

function calculateScenarioB(desiredFinalWeight, configuration) {
  const goldRequired = desiredFinalWeight / ((1 + configuration.alloy) * (1 - configuration.loss));
  const alloyAdded = goldRequired * configuration.alloy;
  const materialBeforeLoss = goldRequired + alloyAdded;
  const lossInGrams = materialBeforeLoss * configuration.loss;
  const goldCost = goldRequired * configuration.goldPrice;
  const laborCost = desiredFinalWeight * configuration.laborPrice;

  return {
    baseWeight: desiredFinalWeight,
    finalWeight: desiredFinalWeight,
    gold: goldRequired,
    alloy: alloyAdded,
    material: materialBeforeLoss,
    loss: lossInGrams,
    goldCost,
    laborCost,
    finalPrice: goldCost + laborCost
  };
}

function normalizeWeights(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  return [...new Set(
    values
      .slice(0, MAX_WEIGHTS)
      .map(Number)
      .filter((weight) => Number.isFinite(weight) && weight > 0 && weight <= MAX_WEIGHT)
  )].sort((first, second) => first - second);
}

function validateState(state) {
  if (!state || typeof state !== "object") {
    return null;
  }

  const normalized = {
    precoOuro: Number(state.precoOuro),
    maoDeObra: Number(state.maoDeObra),
    percentualPerda: Number(state.percentualPerda),
    percentualLiga: Number(state.percentualLiga),
    tipoCalculo: state.tipoCalculo,
    pesos: normalizeWeights(state.pesos)
  };

  if (
    !Number.isFinite(normalized.precoOuro) ||
    !Number.isFinite(normalized.maoDeObra) ||
    !Number.isFinite(normalized.percentualPerda) ||
    !Number.isFinite(normalized.percentualLiga) ||
    normalized.precoOuro < 0 ||
    normalized.maoDeObra < 0 ||
    normalized.percentualPerda < 0 ||
    normalized.percentualPerda >= 100 ||
    normalized.percentualLiga < 0 ||
    !["A", "B"].includes(normalized.tipoCalculo) ||
    normalized.pesos === null
  ) {
    return null;
  }

  return normalized;
}

function initializeApplication() {
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const numberFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const elements = {
    root: document.documentElement,
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    form: document.getElementById("calculatorForm"),
    goldPrice: document.getElementById("precoOuro"),
    laborPrice: document.getElementById("maoDeObra"),
    lossPercentage: document.getElementById("percentualPerda"),
    alloyPercentage: document.getElementById("percentualLiga"),
    scenarioInputs: [...document.querySelectorAll('input[name="tipoCalculo"]')],
    newWeight: document.getElementById("novoPeso"),
    addWeightButton: document.getElementById("addWeightButton"),
    weightChips: document.getElementById("weightChips"),
    weightCount: document.getElementById("weightCount"),
    resetButton: document.getElementById("resetButton"),
    shareButton: document.getElementById("shareButton"),
    printButton: document.getElementById("printButton"),
    exportButton: document.getElementById("exportButton"),
    themeToggle: document.getElementById("themeToggle"),
    message: document.getElementById("message"),
    summaryScenario: document.getElementById("summaryScenario"),
    summaryWeights: document.getElementById("summaryWeights"),
    summaryMinimum: document.getElementById("summaryMinimum"),
    summaryMaximum: document.getElementById("summaryMaximum"),
    resultsTitle: document.getElementById("results-title"),
    resultsDescription: document.getElementById("resultsDescription"),
    simulationCount: document.getElementById("simulationCount"),
    resultsHead: document.getElementById("resultsHead"),
    resultsBody: document.getElementById("resultsBody")
  };

  let weights = [...INITIAL_WEIGHTS];
  let currentResults = [];
  let autoCalculateTimer;

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function formatGrams(value) {
    return `${numberFormatter.format(value)} g`;
  }

  function selectedScenario() {
    return elements.scenarioInputs.find((input) => input.checked)?.value || "A";
  }

  function showMessage(text = "", type = "error") {
    elements.message.textContent = text;
    elements.message.dataset.type = type;
    elements.message.hidden = !text;
  }

  function markFieldsAsValid() {
    [
      elements.goldPrice,
      elements.laborPrice,
      elements.lossPercentage,
      elements.alloyPercentage
    ].forEach((field) => field.removeAttribute("aria-invalid"));
  }

  function readConfiguration() {
    markFieldsAsValid();
    const fields = [
      { element: elements.goldPrice, label: "preço do ouro" },
      { element: elements.laborPrice, label: "mão de obra" },
      { element: elements.alloyPercentage, label: "percentual da liga" },
      { element: elements.lossPercentage, label: "percentual de perda" }
    ];

    for (const field of fields) {
      const value = Number(field.element.value);
      if (!Number.isFinite(value) || value < 0) {
        field.element.setAttribute("aria-invalid", "true");
        throw new Error(`Informe um valor válido para ${field.label}.`);
      }
    }

    const lossPercentage = Number(elements.lossPercentage.value);
    if (lossPercentage >= 100) {
      elements.lossPercentage.setAttribute("aria-invalid", "true");
      throw new Error("A perda na fabricação deve ser menor que 100%.");
    }

    return {
      goldPrice: Number(elements.goldPrice.value),
      laborPrice: Number(elements.laborPrice.value),
      loss: lossPercentage / 100,
      alloy: Number(elements.alloyPercentage.value) / 100
    };
  }

  function currentState() {
    return {
      precoOuro: Number(elements.goldPrice.value),
      maoDeObra: Number(elements.laborPrice.value),
      percentualPerda: Number(elements.lossPercentage.value),
      percentualLiga: Number(elements.alloyPercentage.value),
      tipoCalculo: selectedScenario(),
      pesos: [...weights]
    };
  }

  function applyState(state) {
    const validState = validateState(state);
    if (!validState) {
      return false;
    }

    elements.goldPrice.value = validState.precoOuro;
    elements.laborPrice.value = validState.maoDeObra;
    elements.lossPercentage.value = validState.percentualPerda;
    elements.alloyPercentage.value = validState.percentualLiga;
    elements.scenarioInputs.forEach((input) => {
      input.checked = input.value === validState.tipoCalculo;
    });
    weights = [...validState.pesos];
    return true;
  }

  function shareableUrl() {
    const state = currentState();
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("ouro", state.precoOuro);
    url.searchParams.set("mao", state.maoDeObra);
    url.searchParams.set("perda", state.percentualPerda);
    url.searchParams.set("liga", state.percentualLiga);
    url.searchParams.set("cenario", state.tipoCalculo);
    url.searchParams.set("pesos", state.pesos.join(","));
    return url.toString();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState()));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // The calculator remains functional when browser storage is unavailable.
    }

    if (window.location.search) {
      history.replaceState(null, "", shareableUrl());
    }
  }

  function stateFromUrl() {
    const parameters = new URLSearchParams(window.location.search);
    if (!parameters.has("cenario")) {
      return null;
    }

    return {
      precoOuro: parameters.get("ouro"),
      maoDeObra: parameters.get("mao"),
      percentualPerda: parameters.get("perda"),
      percentualLiga: parameters.get("liga"),
      tipoCalculo: parameters.get("cenario"),
      pesos: (parameters.get("pesos") || "").split(",")
    };
  }

  function loadState() {
    if (applyState(stateFromUrl())) {
      return;
    }

    try {
      const savedState = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedState && applyState(JSON.parse(savedState))) {
        return;
      }
    } catch {
      // Invalid or blocked storage falls back to the defaults.
    }

    applyState(DEFAULT_STATE);
  }

  function renderWeights() {
    elements.weightCount.textContent = `${weights.length} ${weights.length === 1 ? "peso" : "pesos"}`;

    if (weights.length === 0) {
      elements.weightChips.innerHTML = '<span class="empty-weights">Nenhum peso adicionado.</span>';
      return;
    }

    elements.weightChips.innerHTML = weights.map((weight, index) => `
      <span class="weight-chip">
        ${formatGrams(weight)}
        <button type="button" data-remove-weight="${index}" aria-label="Remover ${formatGrams(weight)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
        </button>
      </span>
    `).join("");
  }

  function renderSummary(isScenarioA) {
    elements.summaryScenario.textContent = isScenarioA ? "Ouro comprado" : "Peso final desejado";

    if (currentResults.length === 0) {
      elements.summaryWeights.textContent = "Nenhum peso";
      elements.summaryMinimum.textContent = "—";
      elements.summaryMaximum.textContent = "—";
      return;
    }

    const finalPrices = currentResults.map((result) => result.finalPrice);
    const minimumWeight = Math.min(...weights);
    const maximumWeight = Math.max(...weights);
    elements.summaryWeights.textContent = minimumWeight === maximumWeight
      ? formatGrams(minimumWeight)
      : `${formatGrams(minimumWeight)} a ${formatGrams(maximumWeight)}`;
    elements.summaryMinimum.textContent = formatCurrency(Math.min(...finalPrices));
    elements.summaryMaximum.textContent = formatCurrency(Math.max(...finalPrices));
  }

  function renderTableHeader(isScenarioA) {
    elements.resultsHead.innerHTML = isScenarioA
      ? `
        <tr>
          <th scope="col">Ouro comprado</th>
          <th scope="col">Liga adicionada</th>
          <th scope="col">Material inicial</th>
          <th scope="col">Perda</th>
          <th scope="col">Peso final</th>
          <th scope="col">Custo do ouro</th>
          <th scope="col">Mão de obra</th>
          <th scope="col">Preço final</th>
          <th scope="col">Ação</th>
        </tr>
      `
      : `
        <tr>
          <th scope="col">Peso desejado</th>
          <th scope="col">Ouro necessário</th>
          <th scope="col">Liga adicionada</th>
          <th scope="col">Material inicial</th>
          <th scope="col">Perda</th>
          <th scope="col">Custo do ouro</th>
          <th scope="col">Mão de obra</th>
          <th scope="col">Preço final</th>
          <th scope="col">Ação</th>
        </tr>
      `;
  }

  function renderTableBody(isScenarioA) {
    if (currentResults.length === 0) {
      elements.resultsBody.innerHTML = `
        <tr><td class="empty-table" colspan="9">Adicione um peso para iniciar a simulação.</td></tr>
      `;
      return;
    }

    elements.resultsBody.innerHTML = currentResults.map((result, index) => {
      const leadingCells = isScenarioA
        ? `
          <td><strong>${formatGrams(result.gold)}</strong></td>
          <td>${formatGrams(result.alloy)}</td>
          <td>${formatGrams(result.material)}</td>
          <td>${formatGrams(result.loss)}</td>
          <td>${formatGrams(result.finalWeight)}</td>
        `
        : `
          <td><strong>${formatGrams(result.finalWeight)}</strong></td>
          <td>${formatGrams(result.gold)}</td>
          <td>${formatGrams(result.alloy)}</td>
          <td>${formatGrams(result.material)}</td>
          <td>${formatGrams(result.loss)}</td>
        `;

      return `
        <tr>
          ${leadingCells}
          <td>${formatCurrency(result.goldCost)}</td>
          <td>${formatCurrency(result.laborCost)}</td>
          <td class="price-cell">${formatCurrency(result.finalPrice)}</td>
          <td>
            <button class="table-remove" type="button" data-remove-weight="${index}">
              Remover
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function calculateAndRender({ announce = false } = {}) {
    showMessage();

    try {
      const configuration = readConfiguration();
      const isScenarioA = selectedScenario() === "A";

      currentResults = weights.map((weight) => (
        isScenarioA
          ? calculateScenarioA(weight, configuration)
          : calculateScenarioB(weight, configuration)
      ));

      elements.resultsTitle.textContent = isScenarioA
        ? "Cenário A: ouro comprado"
        : "Cenário B: peso final desejado";
      elements.resultsDescription.textContent = isScenarioA
        ? "Os pesos representam a quantidade de ouro puro comprada."
        : "Os pesos representam o peso final que cada joia deve atingir.";
      elements.simulationCount.textContent =
        `${weights.length} ${weights.length === 1 ? "simulação" : "simulações"}`;

      renderWeights();
      renderSummary(isScenarioA);
      renderTableHeader(isScenarioA);
      renderTableBody(isScenarioA);
      saveState();

      if (announce) {
        showMessage("Cálculo atualizado.", "success");
      }
    } catch (error) {
      currentResults = [];
      showMessage(error.message);
    }
  }

  function scheduleCalculation() {
    window.clearTimeout(autoCalculateTimer);
    autoCalculateTimer = window.setTimeout(() => calculateAndRender(), 220);
  }

  function addWeight() {
    const newWeight = Number(elements.newWeight.value);

    if (!Number.isFinite(newWeight) || newWeight <= 0 || newWeight > MAX_WEIGHT) {
      showMessage(`Informe um peso entre 0,01 g e ${MAX_WEIGHT.toLocaleString("pt-BR")} g.`);
      elements.newWeight.focus();
      return;
    }

    if (weights.length >= MAX_WEIGHTS) {
      showMessage(`O limite é de ${MAX_WEIGHTS} pesos por simulação.`);
      return;
    }

    if (weights.includes(newWeight)) {
      showMessage("Esse peso já está na simulação.");
      elements.newWeight.focus();
      return;
    }

    weights.push(newWeight);
    weights.sort((first, second) => first - second);
    elements.newWeight.value = "";
    calculateAndRender();
    elements.newWeight.focus();
  }

  function removeWeight(index) {
    if (!Number.isInteger(index) || index < 0 || index >= weights.length) {
      return;
    }

    weights.splice(index, 1);
    calculateAndRender();
  }

  function resetCalculator() {
    applyState(DEFAULT_STATE);
    calculateAndRender();
    showMessage("Valores padrão restaurados.", "success");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    if (!copied) {
      throw new Error("copy-failed");
    }
  }

  async function shareSimulation() {
    calculateAndRender();
    if (currentResults.length === 0) {
      showMessage("Adicione pelo menos um peso antes de compartilhar.");
      return;
    }

    if (window.location.protocol === "file:") {
      showMessage("O link compartilhável fica disponível quando a página é publicada.");
      return;
    }

    const url = shareableUrl();
    const data = {
      title: "Simulação de joia em ouro",
      text: "Confira esta simulação de custo para fabricação de uma joia em ouro.",
      url
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        showMessage("Simulação compartilhada.", "success");
        return;
      }

      await copyText(url);
      showMessage("Link da simulação copiado.", "success");
    } catch (error) {
      if (error.name !== "AbortError") {
        showMessage("Não foi possível copiar o link. Use o endereço exibido no navegador.");
      }
    }
  }

  function csvNumber(value) {
    return value.toFixed(2).replace(".", ",");
  }

  function escapeCsv(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    calculateAndRender();
    if (currentResults.length === 0) {
      showMessage("Adicione pelo menos um peso antes de exportar.");
      return;
    }

    const isScenarioA = selectedScenario() === "A";
    const headers = isScenarioA
      ? [
          "Ouro comprado (g)",
          "Liga adicionada (g)",
          "Material antes da perda (g)",
          "Perda (g)",
          "Peso final (g)",
          "Custo do ouro (R$)",
          "Mão de obra (R$)",
          "Preço final (R$)"
        ]
      : [
          "Peso final desejado (g)",
          "Ouro necessário (g)",
          "Liga adicionada (g)",
          "Material antes da perda (g)",
          "Perda (g)",
          "Custo do ouro (R$)",
          "Mão de obra (R$)",
          "Preço final (R$)"
        ];

    const rows = currentResults.map((result) => {
      const values = isScenarioA
        ? [
            result.gold,
            result.alloy,
            result.material,
            result.loss,
            result.finalWeight,
            result.goldCost,
            result.laborCost,
            result.finalPrice
          ]
        : [
            result.finalWeight,
            result.gold,
            result.alloy,
            result.material,
            result.loss,
            result.goldCost,
            result.laborCost,
            result.finalPrice
          ];

      return values.map((value) => escapeCsv(csvNumber(value))).join(";");
    });

    const content = [headers.map(escapeCsv).join(";"), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `aurum-calc-cenario-${selectedScenario().toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    showMessage("Arquivo CSV gerado.", "success");
  }

  function setTheme(theme, persist = true) {
    elements.root.dataset.theme = theme;
    elements.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
    );
    elements.themeMeta.setAttribute("content", theme === "dark" ? "#11100e" : "#f4f0e7");

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Theme persistence is optional.
      }
    }
  }

  function loadTheme() {
    let savedTheme;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch {
      // Use the operating system preference.
    }

    const preferredTheme = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
    setTheme(savedTheme || preferredTheme, false);
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateAndRender({ announce: true });
  });

  [
    elements.goldPrice,
    elements.laborPrice,
    elements.lossPercentage,
    elements.alloyPercentage
  ].forEach((field) => field.addEventListener("input", scheduleCalculation));

  elements.scenarioInputs.forEach((input) => {
    input.addEventListener("change", () => calculateAndRender());
  });

  elements.addWeightButton.addEventListener("click", addWeight);
  elements.newWeight.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addWeight();
    }
  });

  [elements.weightChips, elements.resultsBody].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-weight]");
      if (button) {
        removeWeight(Number(button.dataset.removeWeight));
      }
    });
  });

  elements.resetButton.addEventListener("click", resetCalculator);
  elements.shareButton.addEventListener("click", shareSimulation);
  elements.printButton.addEventListener("click", () => window.print());
  elements.exportButton.addEventListener("click", exportCsv);
  elements.themeToggle.addEventListener("click", () => {
    setTheme(elements.root.dataset.theme === "dark" ? "light" : "dark");
  });

  loadTheme();
  loadState();
  calculateAndRender();
}

if (typeof document !== "undefined") {
  initializeApplication();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateScenarioA,
    calculateScenarioB,
    normalizeWeights,
    validateState
  };
}
