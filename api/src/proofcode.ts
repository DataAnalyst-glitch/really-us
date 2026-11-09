import type { CompanyConfig, Notice, ProofState } from "./types.js";

export function normalizeProofCode(code: string): string {
  return code.trim().toUpperCase();
}

// Pure. "valid" only when the code has the right format AND matches a real notice of this company.
// It says nothing about any account. A missing code is "absent", never proof of anything.
export function checkProofCode(config: CompanyConfig, supplied: string | undefined, notice: Notice | undefined): ProofState {
  if (supplied === undefined || supplied.trim() === "") return "absent";
  const code = normalizeProofCode(supplied);
  const formatOk = new RegExp(config.notice_rules.proof_code_pattern).test(code);
  const matches = notice !== undefined && notice.company_id === config.company_id && notice.proof_code === code;
  return formatOk && matches ? "valid" : "invalid";
}
