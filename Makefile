.PHONY: verify harness test
verify: harness test
harness:
	python3 scripts/harness_check.py
# Claude Code: replace with the API test command once api/ exists. Must fail if tests fail.
test:
	@if [ -f api/package.json ]; then cd api && npm test; else echo "api not built yet"; fi
