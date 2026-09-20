<!--
  Action hints for AI agents & contributors.
-->
# Collaboration notes

- The browsable/docs contract lives at `docs/`.
- Run backend tests: `cd backend && source .venv/bin/activate && python -m pytest tests/ -q`
- After changing `app/comparison` or privacy facts: `python scripts/update_comparison.py --refresh`
- Type-check frontend: `cd frontend && npm run build` (runs `tsc -b && vite build`)
- Never re-enable query logging; the test suite asserts the privacy invariants
  in `backend/tests/test_core.py`.
- The project is AGPL-3.0 and credits SearXNG in NOTICE. Keep third-party
  attributions intact.