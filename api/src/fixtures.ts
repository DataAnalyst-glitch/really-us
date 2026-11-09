import type { Notice } from "./types.js";

// Fictional demo notices. Accounts DEMO-xx-x002 deliberately have no notice.
export const fixtureNotices: Notice[] = [
  { notice_id: "N-NP-1", company_id: "northline", demo_account: "DEMO-NP-1001", proof_code: "NP-4821" },
  { notice_id: "N-EB-1", company_id: "examplia_bank", demo_account: "DEMO-EB-2001", proof_code: "EB-7314" },
  { notice_id: "N-EM-1", company_id: "examplia_mobile", demo_account: "DEMO-EM-3001", proof_code: "EM-5528" },
];
