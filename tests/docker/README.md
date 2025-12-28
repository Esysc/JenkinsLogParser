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

Four pre-configured jobs are available:

| Job                | Description                        | Type      | Result   |
| ------------------ | ---------------------------------- | --------- | -------- |
| `sample-test-job`  | Mixed results (4 pass, 2 fail)     | Freestyle | UNSTABLE |
| `passing-build`    | All tests pass                     | Freestyle | SUCCESS  |
| `failing-build`    | All tests fail                     | Freestyle | FAILURE  |
| `pipeline-example` | Multi-stage pipeline with 6 stages | Pipeline  | UNSTABLE |

## Testing the Extension

1. Load the extension in Chrome (`chrome://extensions/`)
2. Open Jenkins: http://localhost:8080
3. Click on a job → Build Now
4. Click "Console Output"
5. The extension should activate and colorize the logs

## Login Credentials

-   **Username:** admin
-   **Password:** admin

(Anonymous read access is also enabled)

## Useful URLs

-   Jenkins home: http://localhost:8080
-   Sample job console: http://localhost:8080/job/sample-test-job/lastBuild/console

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
