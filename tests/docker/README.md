# Docker E2E Testing (Optional)

This directory provides an optional Docker-based Jenkins environment for manual end-to-end testing.

> **Note:** The main test suite uses Jest and doesn't require Docker. Run `npm test` from the project root for automated testing.

## When to Use This

-   Manual verification of the extension in a real browser
-   Visual testing of UI features
-   Testing against actual Jenkins log output

## Docker Jenkins Setup

A Docker setup for testing with a real Jenkins instance.

### Quick Start

```bash
cd tests/docker

# Start Jenkins
docker compose up -d

# Wait ~30 seconds for Jenkins to initialize
# Then open: http://localhost:8080
```

## Test Jobs

Six pre-configured jobs are available:

| Job                | Description                                    | Type      | Result   |
| ------------------ | ---------------------------------------------- | --------- | -------- |
| `stress-test`      | **STRESS TEST: 10,500+ lines for performance** | Pipeline  | SUCCESS  |
| `demo-patterns`    | Comprehensive demo of all log pattern types    | Pipeline  | UNSTABLE |
| `sample-test-job`  | Mixed results (4 pass, 2 fail)                 | Freestyle | UNSTABLE |
| `passing-build`    | All tests pass                                 | Freestyle | SUCCESS  |
| `failing-build`    | All tests fail                                 | Freestyle | FAILURE  |
| `pipeline-example` | Multi-stage pipeline with 6 stages             | Pipeline  | UNSTABLE |

## Testing the Extension

1. Load the extension in Chrome (`chrome://extensions/`)
2. Open Jenkins: <http://localhost:8080>
3. **For stress testing** → Click on `stress-test` job → Build Now
    - Generates 10,500+ log lines in real-time
    - Tests auto-follow and performance under heavy load
    - Ideal for verifying the performance optimizations
    - Watch browser responsiveness and auto-follow behavior
4. **For feature demo** → Click on `demo-patterns` job → Build Now

### Performance Testing (`stress-test`)

The **stress-test** job generates 10,500+ log lines to validate performance optimizations:

-   **Stage 1:** 2000 INFO lines (baseline)
-   **Stage 2:** 1000 DEBUG lines (mixed)
-   **Stage 3:** 300 test cases with mixed results
-   **Stage 4:** 3000+ Maven/JUnit tests and pipeline commands
-   **Stage 5:** 2000 rapid-fire events (simulates live build)

**What to verify:**

-   ✅ Total render time < 10 seconds
-   ✅ Auto-follow stays active (📡 Follow button)
-   ✅ Navigator populates with 50+ items
-   ✅ Stats counter updates smoothly
-   ✅ Browser stays responsive (no freezing)
-   ✅ Memory usage < 100MB

Run this job **while opening Console Output** to watch real-time rendering.

## Login Credentials

-   **Username:** admin
-   **Password:** admin

(Anonymous read access is also enabled)

## Useful URLs

-   Jenkins home: <http://localhost:8080>
-   Sample job console: <http://localhost:8080/job/sample-test-job/lastBuild/console>

## Commands

```bash
# Start Jenkins
docker-compose up -d

# View logs
docker-compose logs -f

# Stop Jenkins
docker-compose down

# Stop and remove data
docker-compose down -v
```
