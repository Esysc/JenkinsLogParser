/**
 * @jest-environment jsdom
 */

const LogParserUtils = require('../log-parser-utils');

describe('LogParserUtils', () => {
    describe('escapeHtml', () => {
        test('escapes HTML special characters', () => {
            expect(LogParserUtils.escapeHtml('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert("xss")&lt;/script&gt;'
            );
        });

        test('escapes ampersands', () => {
            expect(LogParserUtils.escapeHtml('foo & bar')).toBe('foo &amp; bar');
        });

        test('handles empty string', () => {
            expect(LogParserUtils.escapeHtml('')).toBe('');
        });

        test('handles regular text without escaping', () => {
            expect(LogParserUtils.escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('detectLogLevel', () => {
        test('detects ERROR level', () => {
            const result = LogParserUtils.detectLogLevel('[ERROR] Something went wrong');
            expect(result.level).toBe('ERROR');
            expect(result.color).toBe('#F90636');
        });

        test('detects WARN level', () => {
            const result = LogParserUtils.detectLogLevel('[WARN] Warning message');
            expect(result.level).toBe('WARN');
            expect(result.color).toBe('#F97106');
        });

        test('detects INFO level', () => {
            const result = LogParserUtils.detectLogLevel('[INFO] Information message');
            expect(result.level).toBe('INFO');
            expect(result.color).toBe('#061CF9');
        });

        test('detects DEBUG level', () => {
            const result = LogParserUtils.detectLogLevel('[DEBUG] Debug message');
            expect(result.level).toBe('DEBUG');
            expect(result.color).toBe('#C906F9');
        });

        test('returns OTHER for unknown level', () => {
            const result = LogParserUtils.detectLogLevel('Some random log line');
            expect(result.level).toBe('OTHER');
            expect(result.color).toBe('');
        });

        test('prioritizes first matched level', () => {
            // ERROR should be detected first even if line contains INFO
            const result = LogParserUtils.detectLogLevel('[ERROR] INFO message');
            expect(result.level).toBe('ERROR');
        });
    });

    describe('isTestCaseStart', () => {
        test('returns true for test case start line', () => {
            expect(LogParserUtils.isTestCaseStart('Starting TestCase: LoginTest')).toBe(true);
        });

        test('returns false for regular line', () => {
            expect(LogParserUtils.isTestCaseStart('[INFO] Regular log line')).toBe(false);
        });
    });

    describe('isTestCaseSummary', () => {
        test('returns true for test case summary line', () => {
            expect(
                LogParserUtils.isTestCaseSummary('SUMMARY of TestCase [LoginTest]: PASSED')
            ).toBe(true);
        });

        test('returns false for regular line', () => {
            expect(LogParserUtils.isTestCaseSummary('[INFO] Regular log line')).toBe(false);
        });
    });

    describe('extractTestName', () => {
        test('extracts test name from start line', () => {
            expect(LogParserUtils.extractTestName('Starting TestCase: LoginTest')).toBe(
                'LoginTest'
            );
        });

        test('trims whitespace from test name', () => {
            expect(LogParserUtils.extractTestName('Starting TestCase:   SpacedTest  ')).toBe(
                'SpacedTest'
            );
        });

        test('returns empty string for non-test line', () => {
            expect(LogParserUtils.extractTestName('[INFO] Regular line')).toBe('');
        });
    });

    describe('isTestPassed', () => {
        test('returns true for passed test', () => {
            expect(LogParserUtils.isTestPassed('SUMMARY of TestCase [LoginTest]: PASSED')).toBe(
                true
            );
        });

        test('returns false for failed test with ERROR', () => {
            expect(LogParserUtils.isTestPassed('SUMMARY of TestCase [LoginTest]: ERROR')).toBe(
                false
            );
        });
    });

    describe('parseLogContent', () => {
        const sampleLog = `[INFO] Starting build
Starting TestCase: LoginTest
[INFO] Running test
[DEBUG] Loading page
[WARN] Slow response
SUMMARY of TestCase [LoginTest]: PASSED
Starting TestCase: FailingTest
[ERROR] Test failed
SUMMARY of TestCase [FailingTest]: ERROR
[INFO] Build complete`;

        test('counts log levels correctly', () => {
            const { stats } = LogParserUtils.parseLogContent(sampleLog);
            expect(stats.INFO).toBe(3);
            expect(stats.DEBUG).toBe(1);
            expect(stats.WARN).toBe(1);
            expect(stats.ERROR).toBe(2); // [ERROR] line + SUMMARY line containing ERROR
            expect(stats.total).toBe(10);
        });

        test('extracts test cases', () => {
            const { testCases } = LogParserUtils.parseLogContent(sampleLog);
            expect(testCases).toHaveLength(2);
            expect(testCases[0].name).toBe('LoginTest');
            expect(testCases[0].passed).toBe(true);
            expect(testCases[1].name).toBe('FailingTest');
            expect(testCases[1].passed).toBe(false);
        });

        test('returns all lines', () => {
            const { lines } = LogParserUtils.parseLogContent(sampleLog);
            expect(lines).toHaveLength(10);
        });
    });

    describe('formatLineNumber', () => {
        test('pads single digit', () => {
            expect(LogParserUtils.formatLineNumber(1)).toBe('    1');
        });

        test('pads double digit', () => {
            expect(LogParserUtils.formatLineNumber(42)).toBe('   42');
        });

        test('handles custom padding', () => {
            expect(LogParserUtils.formatLineNumber(1, 3)).toBe('  1');
        });

        test('handles large numbers', () => {
            expect(LogParserUtils.formatLineNumber(12345)).toBe('12345');
        });
    });

    describe('createElement', () => {
        test('creates element with tag', () => {
            const el = LogParserUtils.createElement('div');
            expect(el.tagName).toBe('DIV');
        });

        test('sets className', () => {
            const el = LogParserUtils.createElement('div', { className: 'test-class' });
            expect(el.className).toBe('test-class');
        });

        test('sets attributes', () => {
            const el = LogParserUtils.createElement('div', { id: 'test-id', 'data-value': '123' });
            expect(el.id).toBe('test-id');
            expect(el.getAttribute('data-value')).toBe('123');
        });

        test('adds string children as innerHTML', () => {
            const el = LogParserUtils.createElement('div', {}, ['<span>Test</span>']);
            expect(el.innerHTML).toBe('<span>Test</span>');
        });

        test('appends element children', () => {
            const child = document.createElement('span');
            const el = LogParserUtils.createElement('div', {}, [child]);
            expect(el.children[0]).toBe(child);
        });
    });

    describe('filterLines', () => {
        const lines = [
            '[ERROR] Error message',
            '[INFO] Info message',
            '[DEBUG] Debug message',
            'Plain text',
        ];

        test('filters by single level', () => {
            const result = LogParserUtils.filterLines(lines, new Set(['ERROR']));
            expect(result).toHaveLength(1);
            expect(result[0].index).toBe(0);
        });

        test('filters by multiple levels', () => {
            const result = LogParserUtils.filterLines(lines, new Set(['ERROR', 'INFO']));
            expect(result).toHaveLength(2);
        });

        test('includes OTHER level', () => {
            const result = LogParserUtils.filterLines(lines, new Set(['OTHER']));
            expect(result).toHaveLength(1);
            expect(result[0].line).toBe('Plain text');
        });
    });

    describe('searchLines', () => {
        const lines = [
            '[ERROR] Connection failed',
            '[INFO] Server started',
            '[DEBUG] Loading config',
            '[INFO] Connection established',
        ];

        test('finds matching lines', () => {
            const result = LogParserUtils.searchLines(lines, 'connection');
            expect(result).toEqual([0, 3]);
        });

        test('is case insensitive', () => {
            const result = LogParserUtils.searchLines(lines, 'CONNECTION');
            expect(result).toEqual([0, 3]);
        });

        test('returns empty for short query', () => {
            const result = LogParserUtils.searchLines(lines, 'c');
            expect(result).toEqual([]);
        });

        test('returns empty for no matches', () => {
            const result = LogParserUtils.searchLines(lines, 'xyz123');
            expect(result).toEqual([]);
        });
    });
});
