import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static checks on the two console pages. They do not run a browser.
const read = (name: string) => readFileSync(new URL(`../../console/${name}`, import.meta.url), "utf8");
const home = read("index.html");
const trust = read("trust.html");
const script = (html: string) => /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

describe("console/index.html (fictional Northline demo home page)", () => {
  it("is clearly labelled as a fictional demo", () => {
    expect(home).toMatch(/DEMO\. Northline Power is a fictional company/);
    expect(home).toContain("Fictional demo");
    expect(home).toContain("Got a message from us? Check it.");
  });

  it("has a slot for the eGain widget and does not load anything external or run script", () => {
    expect(home).toContain('id="egain-widget-slot"');
    expect(home).not.toMatch(/<script/i);
    expect(home).not.toMatch(/(src|href)="https?:\/\//i);
  });

  it("shows the fictional Proof Code and official channels from the Northline config", () => {
    expect(home).toContain("NP-4821");
    for (const channel of ["northline.example", "notices@northline.example", "NLPOWER", "+1 555 0100", "+1 555 0101"]) {
      expect(home).toContain(channel);
    }
  });
});

describe("console/trust.html (Trust Console)", () => {
  const js = script(trust);

  it("has the Demo data label, four counts, outbreaks, live feed and Reset Demo", () => {
    expect(trust).toContain("Demo data");
    for (const id of ["c-reports", "c-cases", "c-outbreaks", "c-alerts", 'id="outbreaks"', 'id="feed"', 'id="reset-btn"']) {
      expect(trust).toContain(id);
    }
    expect(trust).toContain("Reset Demo");
    expect(trust).toContain("Approve alert");
  });

  it("the user types the demo key; no key is embedded and none is stored", () => {
    expect(trust).toMatch(/<input id="key" type="password"/);
    expect(js).toContain('"X-Demo-Key": demoKey');
    expect(trust).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(trust).not.toMatch(/[?&](key|demo_key)=/);
    expect(trust).not.toMatch(/demo-key-for-tests|test-demo-key/);
  });

  it("builds the page from text only: no HTML injection, no eval, no external scripts", () => {
    expect(js.length).toBeGreaterThan(500);
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/);
    expect(trust).not.toMatch(/<script[^>]*src=/i);
    expect(trust).not.toMatch(/https?:\/\//);
  });

  it("calls only the console endpoints, with confirmed and an idempotency key on every write", () => {
    for (const path of ["/v1/console/state", "/v1/demo/reset", "/approve", "/draft"]) expect(js).toContain(path);
    expect((js.match(/confirmed: true/g) ?? []).length).toBe(4);
    expect((js.match(/idempotency_key:/g) ?? []).length).toBe(4);
  });

  it("has the tinted boxes and a readable Reset Demo in every state, and keeps status words", () => {
    for (const cls of [".count.reports", ".count.cases", ".count.outbreaks", ".count.alerts", ".box.alert", ".box.draft", ".feed"]) {
      expect(trust).toContain(cls);
    }
    for (const rule of ["button.warn:hover", "button.warn.armed:hover", "button:disabled"]) expect(trust).toContain(rule);
    // no teal hover rule may reach the red Reset button (it caused dark text on a dark background)
    expect(trust).toContain("button:not(.plain):not(.warn):hover");
    expect(trust).toMatch(/Suspected/);
    expect(trust).toMatch(/Approved/);
  });

  it("the script parses", () => {
    expect(() => new Function(js)).not.toThrow();
  });
});
