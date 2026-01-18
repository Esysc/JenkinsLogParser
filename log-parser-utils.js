/**
 * Core utility functions for Log Parser
 * Extracted for testability
 */

const LogParserUtils = {
    LOG_LEVELS: {
        ERROR: { color: '#F90636', priority: 1 },
        WARN: { color: '#F97106', priority: 2 },
        INFO: { color: '#061CF9', priority: 3 },
        DEBUG: { color: '#C906F9', priority: 4 },
    },

    // Navigation markers - patterns to detect stages/steps/test cases
    NAVIGATION_PATTERNS: [
        // Test case patterns
        {
            start: /Starting TestCase:\s*(.+)$/i,
            end: /SUMMARY of TestCase \[([^\]]+)\]:\s*(\w+)/i,
            type: 'test',
        },
        // Pipeline stage patterns
        {
            start: /^\[Pipeline\]\s+stage\s*\(?['"]?(.+?)['"]?\)?/i,
            end: /^\[Pipeline\]\s+\/\s*stage/i,
            type: 'stage',
        },
        {
            start: /^Stage\s+['"]?(.+?)['"]?\s+started/i,
            end: /^Stage\s+['"]?(.+?)['"]?\s+(completed|failed)/i,
            type: 'stage',
        },
        { start: /^\[(.+?)\]\s+Stage/i, end: null, type: 'stage' },
        // Maven/Gradle test patterns
        { start: /^Running\s+(.+)$/i, end: /^Tests run:\s*\d+.*?in\s+(.+)$/i, type: 'test' },
        // JUnit patterns
        { start: /^Test:\s+(.+)$/i, end: /^Test\s+(.+?)\s+(PASSED|FAILED)/i, type: 'test' },
        // Generic step patterns
        { start: /^\[Pipeline\]\s+\{\s*\((.+?)\)/i, end: /^\[Pipeline\]\s+\}/i, type: 'step' },
        { start: /^\+\s+(.+)$/i, end: null, type: 'step' },
    ],

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Detect log level from a line
     * @param {string} line - Log line
     * @returns {{ level: string, color: string }} - Detected level and color
     */
    detectLogLevel(line) {
        for (const [level, config] of Object.entries(this.LOG_LEVELS)) {
            if (line.includes(level)) {
                return { level, color: config.color };
            }
        }
        return { level: 'OTHER', color: '' };
    },

    /**
     * Check if line matches any start pattern
     * @param {string} line - Log line
     * @returns {{ matched: boolean, pattern: object, name: string }} - Match info
     */
    isNavigationStart(line) {
        for (const pattern of this.NAVIGATION_PATTERNS) {
            const match = line.match(pattern.start);
            if (match) {
                return {
                    matched: true,
                    pattern: pattern,
                    name: match[1] ? match[1].trim() : line.trim(),
                };
            }
        }
        return { matched: false, pattern: null, name: '' };
    },

    /**
     * Check if line is a test case start (legacy compatibility)
     * @param {string} line - Log line
     * @returns {boolean}
     */
    isTestCaseStart(line) {
        return this.isNavigationStart(line).matched;
    },

    /**
     * Check if line matches any end pattern
     * @param {string} line - Log line
     * @param {object} activePattern - The pattern we're looking for an end to
     * @returns {{ matched: boolean, passed: boolean, name: string }}
     */
    isNavigationEnd(line, activePattern) {
        if (!activePattern || !activePattern.end) {
            return { matched: false, passed: true, name: '' };
        }
        const match = line.match(activePattern.end);
        if (match) {
            const passed =
                !line.includes('ERROR') && !line.includes('FAILED') && !line.includes('failed');
            return {
                matched: true,
                passed: passed,
                name: match[1] ? match[1].trim() : '',
            };
        }
        return { matched: false, passed: true, name: '' };
    },

    /**
     * Check if line is a test case summary (legacy compatibility)
     * @param {string} line - Log line
     * @returns {boolean}
     */
    isTestCaseSummary(line) {
        const legacyPattern = this.NAVIGATION_PATTERNS[0];
        return this.isNavigationEnd(line, legacyPattern).matched;
    },

    /**
     * Extract test/stage/step name from line
     * @param {string} line - Log line containing navigation marker
     * @returns {string} - Name extracted
     */
    extractTestName(line) {
        const result = this.isNavigationStart(line);
        return result.matched ? result.name : '';
    },

    /**
     * Check if test case passed or failed
     * @param {string} line - Summary line
     * @returns {boolean} - true if passed, false if error
     */
    isTestPassed(line) {
        return !line.includes('ERROR');
    },

    /**
     * Parse log content and return stats
     * @param {string} content - Full log content
     * @returns {{ stats: object, testCases: array, lines: array }}
     */
    parseLogContent(content) {
        const lines = content.split('\n');
        const stats = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0, total: 0 };
        const testCases = [];
        let currentTest = null;

        lines.forEach((line, index) => {
            const { level } = this.detectLogLevel(line);
            stats[level] = (stats[level] || 0) + 1;
            stats.total++;

            const startMatch = this.isNavigationStart(line);
            if (startMatch.matched) {
                // Close previous test if it didn't have an end marker
                if (currentTest) {
                    currentTest.endLine = index - 1;
                    testCases.push(currentTest);
                }
                currentTest = {
                    name: startMatch.name,
                    type: startMatch.pattern.type,
                    startLine: index,
                    passed: null,
                    pattern: startMatch.pattern,
                };
            }

            if (currentTest) {
                const endMatch = this.isNavigationEnd(line, currentTest.pattern);
                if (endMatch.matched) {
                    currentTest.endLine = index;
                    currentTest.passed = endMatch.passed;
                    testCases.push(currentTest);
                    currentTest = null;
                }
            }
        });

        // Close last test if it didn't have an end marker
        if (currentTest) {
            currentTest.endLine = lines.length - 1;
            testCases.push(currentTest);
        }

        return { stats, testCases, lines };
    },

    /**
     * Format line number with padding
     * @param {number} num - Line number
     * @param {number} padding - Padding width
     * @returns {string}
     */
    formatLineNumber(num, padding = 5) {
        return String(num).padStart(padding, ' ');
    },

    /**
     * Create element with attributes
     * @param {string} tag - HTML tag
     * @param {object} attrs - Attributes
     * @param {array} children - Child elements or strings
     * @returns {HTMLElement}
     */
    createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else {
                el.setAttribute(key, value);
            }
        });
        children.forEach((child) => {
            if (typeof child === 'string') {
                el.innerHTML += child;
            } else if (child) {
                el.appendChild(child);
            }
        });
        return el;
    },

    /**
     * Filter lines by log level
     * @param {array} lines - Array of log lines
     * @param {Set} activeFilters - Set of active log levels
     * @returns {array} - Filtered lines with their original indices
     */
    filterLines(lines, activeFilters) {
        return lines
            .map((line, index) => ({ line, index, level: this.detectLogLevel(line).level }))
            .filter((item) => activeFilters.has(item.level));
    },

    /**
     * Search lines for a query
     * @param {array} lines - Array of log lines
     * @param {string} query - Search query (case insensitive)
     * @returns {array} - Array of matching line indices
     */
    searchLines(lines, query) {
        if (!query || query.length < 2) return [];
        const lowerQuery = query.toLowerCase();
        return lines
            .map((line, index) => ({ line, index }))
            .filter((item) => item.line.toLowerCase().includes(lowerQuery))
            .map((item) => item.index);
    },
};

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogParserUtils;
}
