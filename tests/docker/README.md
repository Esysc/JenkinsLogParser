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

Five pre-configured jobs are available:

| Job                | Description                                     | Type      | Result   |
| ------------------ | ----------------------------------------------- | --------- | -------- |
| `demo-patterns`    | **Comprehensive demo of all log pattern types** | Pipeline  | UNSTABLE |
| `sample-test-job`  | Mixed results (4 pass, 2 fail)                  | Freestyle | UNSTABLE |
| `passing-build`    | All tests pass                                  | Freestyle | SUCCESS  |
| `failing-build`    | All tests fail                                  | Freestyle | FAILURE  |
| `pipeline-example` | Multi-stage pipeline with 6 stages              | Pipeline  | UNSTABLE |

## Testing the Extension

1. Load the extension in Chrome (`chrome://extensions/`)
2. Open Jenkins: <http://localhost:8080>
3. **Recommended:** Click on `demo-patterns` job → Build Now
    - This job showcases all pattern types: Pipeline stages, test cases, Maven tests, JUnit tests, shell commands
    - Open "Console Output" to see the Log Parser extension in action
4. Try other jobs for specific scenarios
5. The extension should activate and colorize the logs with enhanced navigation

### What to Test in `demo-patterns`

The **Navigator dropdown** should show ~15 items with different icons:

-   📦 Pipeline stages (Build, Unit Tests, Integration Tests, etc.)
-   🧪 Test cases (DatabaseConnectionTest, APIEndpointTest, etc.)
-   🧪 Maven/Gradle tests (com.example.UserServiceTest, etc.)
-   🧪 JUnit tests (testSQLInjectionPrevention, etc.)
-   ⚙️ Shell commands (kubectl apply, docker build, etc.)

Other features to verify:

-   **Stats summary** showing ERROR/WARN/INFO/DEBUG counts
-   **Search functionality** with real-time highlighting
-   **Auto-follow** keeping up with live builds
-   **Performance** should remain smooth (~150 log lines)

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
