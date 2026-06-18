# Audium Service Level Objectives (SLOs)

## 1. Availability SLO
**Objective**: 99.9% uptime for the primary API and frontend distribution.
**SLI**: Percentage of HTTP requests yielding a 200-499 status code (excluding 429s for valid rate limiting).
**Error Budget**: 43.8 minutes of allowable downtime per month.

## 2. Inference Latency SLO
**Objective**: 95% of `/api/tts/generate` requests must complete in under 5 seconds.
**SLI**: Time taken from request ingress at Cloud Run to response egress, measured via OpenTelemetry spans.
**Error Budget**: 5% of requests per month can exceed 5 seconds (typically cold starts).

## 3. Training Completion SLO
**Objective**: 95% of all initiated `/api/training/start` Vertex AI jobs must complete successfully.
**SLI**: Percentage of jobs reaching the `SUCCEEDED` state in Vertex AI vs total started jobs.
**Error Budget**: 5% of training jobs can fail (OOM, dataset errors, timeouts) before breaching.

---

## Error Budget Policies

When the Error Budget drops below 0%:
1. Feature freezes are enforced globally across backend and ML repositories.
2. The team pivots 100% capacity to reliability, testing, and caching improvements.
3. Feature deployments remain locked until the rolling 30-day window recovers > 0%.

## Runbooks & Incident Procedures

### 1. High Inference Latency (Breaching 5s)
- **Cause**: Cache thrashing on Vertex AI or slow GCS bucket model reads.
- **Action**: Check `ml-cache-miss` traces. If >20% miss rate, consider deploying an explicit Redis cache layer or increasing container memory.

### 2. High Training Failure Rate
- **Cause**: Corrupted audio processing or Vertex AI capacity issues.
- **Action**: Check `training_job_failures` metric in Google Cloud Logging. Analyze the VAD test suite output. Roll back recent `ml/` deployments if failures spike following a release.

### 3. Rate Limit Violations Spike
- **Cause**: DDoS attack or aggressive polling bug in frontend.
- **Action**: Check Cloud Armor dashboards. If valid attack, verify geo-blocking rules. If legitimate traffic spike, temporarily scale Redis capacity.
