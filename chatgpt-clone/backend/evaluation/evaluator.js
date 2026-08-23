const env = require("../config/env");

function evaluateRun(input = {}) {
  const verification = input.verification || {};
  const critique = input.critique || {};
  const failures = input.state?.failures || [];
  return {
    taskCompletion: Boolean(input.response),
    accuracy: verification.confidence || 0,
    groundedness: verification.grounded ? 1 : 0,
    hallucinationRisk: verification.grounded ? 0 : 1,
    recoverySuccess: failures.length ? Boolean(input.state.metadata?.retries) : true,
    consistency: verification.conflicting ? 0.5 : 1,
    latencyMs: input.latencyMs || 0,
    toolSuccessRate: input.tools?.length ? Math.max(0, 1 - failures.length / input.tools.length) : 1,
    memoryAccuracy: input.state?.memory?.length ? 1 : 0,
    planningAccuracy: input.state?.plan ? 1 : 0,
    confidenceCalibration: critique.confidence || verification.confidence || 0,
    criticScore: critique.score || 0,
    enabled: env.enableEvaluation,
  };
}

module.exports = { evaluateRun };
