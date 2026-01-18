# Navigation Patterns Documentation

## Overview

The Log Parser extension now supports **flexible pattern detection** for navigating through different types of Jenkins log structures. Instead of being limited to a single hardcoded pattern, the navigator can now detect:

-   🔦 **Pipeline Stages**
-   ⚙️ **Pipeline Steps**
-   🧪 **Test Cases** (multiple frameworks)

## Supported Patterns

### 1. Test Case Patterns

#### Original Pattern (Still Supported)

```text
Starting TestCase: LoginTest
...
SUMMARY of TestCase [LoginTest]: PASSED
```

#### Maven/Gradle Tests

```text
Running com.example.UserServiceTest
...
Tests run: 5, Failures: 0, Errors: 0
```

#### JUnit Format

```text
Test: testUserCreation
...
Test testUserCreation PASSED
```

### 2. Pipeline Stage Patterns

#### Jenkins Declarative Pipeline

```text
[Pipeline] stage ('Build')
...
[Pipeline] / stage
```

#### Named Stages

```text
Stage "Build" started
...
Stage "Build" completed
```

#### Bracketed Format

```text
[Build] Stage
...
```

### 3. Pipeline Step Patterns

#### Pipeline Block Steps

```text
[Pipeline] { (Deploy to Staging)
...
[Pipeline] }
```

#### Shell Commands

```text
+ kubectl apply -f deployment.yaml
```

## Pattern Configuration

Patterns are defined in both `log-parser-utils.js` and `magic.js` using the `NAVIGATION_PATTERNS` array:

```javascript
NAVIGATION_PATTERNS: [
    {
        start: /regex-for-start/i,
        end: /regex-for-end/i,
        type: 'test|stage|step',
        icon: '🧪|🔦|⚙️',
    },
    // ... more patterns
];
```

### Pattern Properties

-   **start** (required): Regex to match the beginning of a navigable section. Capture group 1 should contain the name/title
-   **end** (optional): Regex to match the end of a section. If null, only the start line is detected
-   **type**: Classification of the pattern (`'test'`, `'stage'`, `'step'`)
-   **icon**: Emoji icon displayed in the navigator dropdown

## Status Detection

The navigator automatically determines if a section passed or failed by checking for:

-   `ERROR` keyword → Failed (red 🔴)
-   `FAILED` keyword → Failed (red 🔴)
-   `failed` keyword → Failed (red 🔴)
-   Otherwise → Passed (green 🟢)

## Adding Custom Patterns

To add support for custom Jenkins log formats:

1. Open `log-parser-utils.js` or `magic.js`
1. Add a new entry to the `NAVIGATION_PATTERNS` array:

```javascript
{
    start: /^Your Custom Pattern:\s*(.+)$/i,
    end: /^End of Pattern:\s*(.+)$/i,
    type: 'test',  // or 'stage' or 'step'
    icon: '🎯'
}
```

1. Test with sample logs to ensure regex captures correctly

## Examples

### Example 1: Pipeline with Multiple Stages

```text
[Pipeline] stage ('Checkout')
[INFO] Cloning repository
[Pipeline] / stage

[Pipeline] stage ('Build')
[INFO] Compiling code
[ERROR] Build failed
[Pipeline] / stage
```

**Result:** Navigator shows 2 stages, second one marked as failed

### Example 2: Mixed Test Formats

```text
Starting TestCase: UnitTest1
[INFO] Running unit tests
SUMMARY of TestCase [UnitTest1]: PASSED

Running com.example.IntegrationTest
[INFO] Running integration tests
Tests run: 10, Failures: 1, Errors: 0
```

**Result:** Navigator shows both test cases detected by different patterns

### Example 3: Pipeline Steps

```text
[Pipeline] { (Deploy)
+ docker build -t myapp .
+ docker push myapp:latest
[Pipeline] }
```

**Result:** Navigator shows deployment step with nested commands

## Backward Compatibility

All original test case patterns remain supported:

-   `Starting TestCase:` / `SUMMARY of TestCase [...]`
-   Existing logs will continue to work exactly as before
-   Tests and Docker configurations are unaffected

## Performance

Pattern matching uses:

-   Compiled regex for fast matching
-   Early exit on first match
-   Minimal memory overhead
-   No impact on log colorization or other features

## Troubleshooting

**Navigator doesn't show my stages:**

-   Check if your log format matches any existing patterns
-   Add a custom pattern for your specific format
-   Ensure capture group 1 contains the name

**Wrong items appearing in navigator:**

-   Patterns are checked in order - more specific patterns should come first
-   Adjust regex to be more restrictive
-   Test regex at <https://regex101.com/>

**Performance issues:**

-   Complex regex with lookaheads can be slow
-   Keep patterns simple and specific
-   Test with large logs before deploying
