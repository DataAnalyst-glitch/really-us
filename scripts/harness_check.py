#!/usr/bin/env python3
"""Repo harness: required files, rule map, banned claims, no secrets. Exits non-zero on failure."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REQUIRED = ["README.md", "CLAUDE.md", "llms.txt", "docs/PRD.md", "docs/ARCHITECTURE.md", "docs/TECHNOLOGY.md",
            "docs/DESIGN.md", "docs/JUDGES.md", "docs/TEST_PLAN.md", "docs/FRICTION_LOG.md", "docs/DECISIONS.md",
            "docs/CHANGELOG.md", "docs/SUBMISSION.md", "docs/HACKATHON_RULES.md", "egain/README.md", ".githooks/pre-commit"]
RULES = ["Knowledge-based AI Agent", "Published experience", "Pre-chat workflow", "Escalation", "Process workflow",
         "Actions", "Validation"]
# Claim checks apply to outward-facing text only; PRD and CLAUDE.md list these phrases as things not to say.
CLAIM_FILES = ["README.md", "docs/SUBMISSION.md", "docs/JUDGES.md"]
BANNED = [r"\bfirst[- ]ever\b", r"\bworld'?s first\b", r"prevents? (scam )?loss", r"integrated with \w+",
          r"\d+\s?% (saved|savings|reduction)", r"production[- ]ready", r"\bguarantee"]
SECRET = re.compile(r"(sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{30,}\.|ghp_[A-Za-z0-9]{20,})")
SKIP = {".git", "node_modules", "dist", ".netlify"}

def main():
    errors = []
    for rel in REQUIRED:
        if not (ROOT / rel).is_file():
            errors.append(f"missing file: {rel}")
    judges = ROOT / "docs/JUDGES.md"
    if judges.is_file():
        text = judges.read_text(encoding="utf-8")
        errors += [f"JUDGES.md lacks rule: {r}" for r in RULES if r not in text]
    rules_doc = ROOT / "docs/HACKATHON_RULES.md"
    if rules_doc.is_file():
        text = rules_doc.read_text(encoding="utf-8")
        for item in ["01 Knowledge", "02 Published", "03 Pre-chat", "04 Escalation", "05 Process", "06 Actions", "07 Validation",
                     "One-minute video", "up to 150 words", "Fictional test data", "Tie-breakers"]:
            if item not in text:
                errors.append(f"HACKATHON_RULES.md lacks: {item}")
    for rel in CLAIM_FILES:
        p = ROOT / rel
        if p.is_file():
            for pat in BANNED:
                if re.search(pat, p.read_text(encoding="utf-8"), re.I):
                    errors.append(f"unsupported claim in {rel}: {pat}")
    sub = ROOT / "docs/SUBMISSION.md"
    if sub.is_file():
        m = re.search(r"## Description.*?\n(.+?)\n\n## ", sub.read_text(encoding="utf-8"), re.S)
        if not m:
            errors.append("SUBMISSION.md description not found")
        elif len(m.group(1).split()) > 150:
            errors.append("submission description over 150 words")
    for p in ROOT.rglob("*"):
        if p.is_file() and not (set(p.parts) & SKIP):
            if p.name == ".env":
                errors.append(".env must not be in the repo")
            try:
                if SECRET.search(p.read_text(encoding="utf-8")):
                    errors.append(f"possible secret in {p.relative_to(ROOT)}")
            except (UnicodeDecodeError, OSError):
                pass
    for e in errors:
        print("FAIL:", e)
    print("harness:", "FAILED" if errors else "PASSED")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
