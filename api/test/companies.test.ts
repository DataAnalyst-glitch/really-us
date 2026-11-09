import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { companies } from "../src/companies/index.js";
import { northline } from "../src/companies/northline.js";
import { fixtureNotices } from "../src/fixtures.js";
import { expectValidVerdictShape, scamBank, scamMobile, scamNorthline, setup, verify } from "./helpers.js";

const kb = (name: string) => readFileSync(fileURLToPath(new URL(`../../knowledge/${name}`, import.meta.url)), "utf8");

describe("Northline config matches the knowledge articles", () => {
  it("every official channel appears in KB-02", () => {
    const html = kb("KB-02-official-channels.html");
    for (const channel of northline.official_channels) expect(html).toContain(channel);
  });

  it("the Proof Code format and the demo code NP-4821 match KB-01", () => {
    const html = kb("KB-01-how-real-notices-look.html");
    expect(html).toContain("NP-4821");
    expect(new RegExp(northline.notice_rules.proof_code_pattern).test("NP-4821")).toBe(true);
    expect(new RegExp(northline.notice_rules.proof_code_pattern).test("NP-482")).toBe(false);
    expect(fixtureNotices.some((n) => n.company_id === "northline" && n.proof_code === "NP-4821")).toBe(true);
  });
});

describe("company names and contacts are clearly fictional", () => {
  it("has exactly three companies with fictional names", () => {
    expect(Object.values(companies).map((c) => c.display_name).sort()).toEqual(["Examplia Bank", "Examplia Mobile", "Northline Power"]);
  });

  it.each(Object.values(companies))("$display_name uses only .example domains and 555-01xx phones", (c) => {
    const text = [...c.official_channels, ...c.official_senders].join(" ");
    const hosts = text.match(/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/gi) ?? [];
    expect(hosts.length).toBeGreaterThan(0);
    for (const h of hosts) expect(h.endsWith(".example")).toBe(true);
    for (const phone of text.match(/\+1 555 \d{4}/g) ?? []) expect(phone).toMatch(/^\+1 555 01\d\d$/);
    for (const d of c.notice_rules.official_domains) expect(d.endsWith(".example")).toBe(true);
  });
});

describe("T18 three company configs", () => {
  const cases = [
    { id: "northline", scam: scamNorthline, account: "DEMO-NP-1001", code: "NP-4821", own: "northline.example", official: "NLPOWER" },
    { id: "examplia_bank", scam: scamBank, account: "DEMO-EB-2001", code: "EB-7314", own: "examplia-bank.example", official: "EXAMPLIABANK" },
    { id: "examplia_mobile", scam: scamMobile, account: "DEMO-EM-3001", code: "EM-5528", own: "examplia-mobile.example", official: "EXAMPLIAMOBILE" },
  ];
  const clean = "A routine update from us. See our website for details.";

  it.each(cases)("$id: scam text gives MATCHES_SCAM_SIGNS with its own channels only", async ({ id, scam, own }) => {
    const { deps } = setup();
    const res = await verify(deps, { company_id: id, message: scam });
    expectValidVerdictShape(res);
    expect(res.body.verdict).toBe("MATCHES_SCAM_SIGNS");
    const step = String(res.body.next_step);
    expect(step).toContain(`Website: ${own}`);
    for (const other of cases.filter((c) => c.id !== id)) expect(step).not.toContain(other.own);
  });

  it.each(cases)("$id: valid Proof Code or account notice gives GENUINE, nothing else does", async ({ id, account, code, official }) => {
    const { deps } = setup();
    expect((await verify(deps, { company_id: id, message: clean, proof_code: code })).body.verdict).toBe("GENUINE_NOTICE_FOUND");
    expect((await verify(deps, { company_id: id, message: clean, demo_account: account, sender: official })).body.verdict).toBe("GENUINE_NOTICE_FOUND");
    expect((await verify(deps, { company_id: id, message: clean })).body.verdict).toBe("NO_MATCHING_NOTICE");
    expect((await verify(deps, { company_id: id, message: clean, proof_code: "XX-0000" })).body.verdict).toBe("NO_MATCHING_NOTICE");
  });

  it("a Proof Code or account from another company is never accepted", async () => {
    const { deps } = setup();
    for (const a of cases) {
      for (const b of cases.filter((c) => c.id !== a.id)) {
        expect((await verify(deps, { company_id: a.id, message: clean, proof_code: b.code })).body.verdict).toBe("NO_MATCHING_NOTICE");
        expect((await verify(deps, { company_id: a.id, message: clean, demo_account: b.account })).body.verdict).toBe("NO_MATCHING_NOTICE");
      }
    }
  });

  it.each(cases)("$id: real notice plus a scam-style message is never GENUINE", async ({ id, scam, account }) => {
    const { deps } = setup();
    const res = await verify(deps, { company_id: id, message: scam, demo_account: account });
    expect(res.body.verdict).toBe("MATCHES_SCAM_SIGNS");
    expect(String(res.body.next_step)).toContain("does not match the official");
    expect(JSON.stringify(res.body)).not.toContain(account);
  });
});
