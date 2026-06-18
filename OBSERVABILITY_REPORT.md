# Observability + Logging Hardening

## 1. Trace Propagation (FIXED)
- **Status:** **PASS** (Remediated)
- **Notes:** A critical visibility breakage was identified where the ML container was autonomously generating its own `TRACE_ID`, severing the log continuity between the HTTP request and the Vertex job. This was fixed by explicitly passing `{ name: 'TRACE_ID', value: req.id }` via the Express API into the Vertex CustomJob environment dictionary. Logs from Cloud Run and Vertex AI can now be grouped instantaneously via the global `traceId`.

## 2. Structured JSON Output
- **Status:** **PASS**
- **Notes:** The `pino-http` middleware outputs strictly formatted JSON on the backend, while `python-json-logger` perfectly matches the schema structure inside the Python container. No multiline strings or unparsed text blocks will pollute Google Cloud Logging.
