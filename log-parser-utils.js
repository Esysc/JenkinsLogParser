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

    PRE_STRING: 'Starting TestCase:',
    POST_STRING: 'SUMMARY of TestCase [',

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
     * Check if line is a test case start
     * @param {string} line - Log line
     * @returns {boolean}
     */
    isTestCaseStart(line) {
        return line.includes(this.PRE_STRING);
    },

    /**
     * Check if line is a test case summary
     * @param {string} line - Log line
     * @returns {boolean}
     */
    isTestCaseSummary(line) {
        return line.includes(this.POST_STRING);
    },

    /**
     * Extract test name from line
     * @param {string} line - Log line containing test case start
     * @returns {string} - Test name
     */
    extractTestName(line) {
        const index = line.indexOf(this.PRE_STRING);
        if (index === -1) return '';
        return line.substring(index + this.PRE_STRING.length).trim();
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

            if (this.isTestCaseStart(line)) {
                currentTest = {
                    name: this.extractTestName(line),
                    startLine: index,
                    passed: null,
                };
            }

            if (this.isTestCaseSummary(line) && currentTest) {
                currentTest.endLine = index;
                currentTest.passed = this.isTestPassed(line);
                testCases.push(currentTest);
                currentTest = null;
            }
        });

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
