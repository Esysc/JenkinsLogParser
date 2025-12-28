# JenkinsLogParser

A Chrome extension to parse Jenkins console logs with enhanced readability.

## Features

-   **Log Colorization** - Color-codes log lines by severity:
    -   🔴 ERROR (red)
    -   🔵 INFO (blue)
    -   🟣 DEBUG (purple)
    -   🟠 WARN (orange)
-   **Test Case Navigator** - Dropdown menu for quick navigation between test cases
-   **Download Logs** - One-click download of the console output as a text file
-   **HTTPS Support** - Works on both HTTP and HTTPS Jenkins instances

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder

## Notes

-   Uses **Manifest V3** (Chrome's latest extension format)
-   Runs when the page loads completely
-   Test case navigation requires log entries with `"Starting TestCase:"` and `"SUMMARY of TestCase ["`
-   Works best with logs under 10MB

## Changelog

### v0.2.0

-   Migrated to Manifest V3
-   **Removed jQuery dependency** - Now uses vanilla JavaScript (~90KB smaller)
-   Added HTTPS support
-   Fixed XSS vulnerability by escaping HTML in log content
-   Improved performance with batch DOM updates
-   Removed unused permissions
-   Modern ES6+ syntax with IIFE pattern
-   Code cleanup and formatting

### v0.1.0

-   Initial release
