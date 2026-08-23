const { createExecutionState } = require("../execution/execution.state");
const { withRecovery } = require("../agents/recovery.agent");

async function runFailureDemo() {
  const scenarios = ["search timeout", "webpage timeout", "empty results", "conflicting evidence"];
  const results = [];
  for (const scenario of scenarios) {
    const state = createExecutionState({ message: `Demo: ${scenario}` });
    const outcome = await withRecovery(
      async (attempt) => {
        if (attempt < 1) throw new Error(`${scenario} (simulated)`);
        return `Recovered from ${scenario} with an alternate strategy.`;
      },
      () => `Fallback completed for ${scenario}.`,
      state,
      "demo-tool",
    );
    results.push({ scenario, ...outcome, failures: state.failures });
  }
  return { mode: "adversarial", completed: results.length, results };
}

module.exports = { runFailureDemo };
