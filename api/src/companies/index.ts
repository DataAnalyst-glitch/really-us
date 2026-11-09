import type { CompanyConfig } from "../types.js";
import { northline } from "./northline.js";
import { exampliaBank } from "./examplia-bank.js";
import { exampliaMobile } from "./examplia-mobile.js";

export const companies: Record<string, CompanyConfig> = {
  [northline.company_id]: northline,
  [exampliaBank.company_id]: exampliaBank,
  [exampliaMobile.company_id]: exampliaMobile,
};

export function getCompany(company_id: unknown): CompanyConfig | undefined {
  return typeof company_id === "string" && Object.hasOwn(companies, company_id) ? companies[company_id] : undefined;
}
