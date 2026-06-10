const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateScenarioA,
  calculateScenarioB,
  normalizeWeights,
  validateState
} = require("../app.js");

const configuration = {
  goldPrice: 700,
  laborPrice: 80,
  loss: 0.06,
  alloy: 0.2
};

test("cenário A calcula material, perda e preço final", () => {
  const result = calculateScenarioA(10, configuration);

  assert.equal(result.gold, 10);
  assert.equal(result.alloy, 2);
  assert.equal(result.material, 12);
  assert.equal(result.loss, 0.72);
  assert.equal(result.finalWeight, 11.28);
  assert.equal(result.goldCost, 7000);
  assert.equal(result.laborCost, 902.4);
  assert.equal(result.finalPrice, 7902.4);
});

test("cenário B reverte liga e perda para encontrar o ouro necessário", () => {
  const result = calculateScenarioB(10, configuration);

  assert.ok(Math.abs(result.gold - 8.865248226950355) < 1e-12);
  assert.ok(Math.abs(result.finalWeight - 10) < 1e-12);
  assert.ok(Math.abs(result.material * (1 - configuration.loss) - 10) < 1e-12);
  assert.ok(Math.abs(result.finalPrice - 6119.148936170213) < 1e-10);
});

test("normalização remove duplicados, inválidos e ordena os pesos", () => {
  assert.deepEqual(
    normalizeWeights([20, "10", 20, -1, 0, "inválido", 15]),
    [10, 15, 20]
  );
});

test("validação aceita um estado completo", () => {
  assert.deepEqual(
    validateState({
      precoOuro: "700",
      maoDeObra: "80",
      percentualPerda: "6",
      percentualLiga: "20",
      tipoCalculo: "B",
      pesos: ["15", "10"]
    }),
    {
      precoOuro: 700,
      maoDeObra: 80,
      percentualPerda: 6,
      percentualLiga: 20,
      tipoCalculo: "B",
      pesos: [10, 15]
    }
  );
});

test("validação rejeita perda de 100% e cenários desconhecidos", () => {
  assert.equal(validateState({
    ...DEFAULT_TEST_STATE,
    percentualPerda: 100
  }), null);

  assert.equal(validateState({
    ...DEFAULT_TEST_STATE,
    tipoCalculo: "C"
  }), null);
});

const DEFAULT_TEST_STATE = {
  precoOuro: 700,
  maoDeObra: 80,
  percentualPerda: 6,
  percentualLiga: 20,
  tipoCalculo: "A",
  pesos: [10]
};
