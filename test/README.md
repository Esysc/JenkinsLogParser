# Test Environment

This directory contains testing resources for the Log Parser extension.

## Docker Jenkins Setup

A Docker setup for testing with a real Jenkins instance.

### Quick Start

```bash
cd test

# Start Jenkins
docker compose up -d

# Wait ~30 seconds for Jenkins to initialize
# Then open: http://localhost:8080
```

## Test Jobs

Three pre-configured jobs are available:

| Job               | Description                    | Result   |
| ----------------- | ------------------------------ | -------- |
| `sample-test-job` | Mixed results (4 pass, 2 fail) | UNSTABLE |
| `passing-build`   | All tests pass                 | SUCCESS  |
| `failing-build`   | All tests fail                 | FAILURE  |

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
