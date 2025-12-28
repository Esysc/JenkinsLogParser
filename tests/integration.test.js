/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Extension Integration', () => {
    let magicJs;

    beforeAll(() => {
        // Read the actual magic.js file
        magicJs = fs.readFileSync(path.join(__dirname, '../magic.js'), 'utf8');
    });

    describe('magic.js', () => {
        test('is valid JavaScript', () => {
            expect(() => {
                new Function(magicJs);
            }).not.toThrow();
        });

        test('is wrapped in IIFE', () => {
            expect(magicJs.trim().startsWith('(() => {')).toBe(true);
            expect(magicJs.trim().endsWith('})();')).toBe(true);
        });

        test('uses strict mode', () => {
            expect(magicJs).toContain("'use strict'");
        });

        test('contains required log levels', () => {
            expect(magicJs).toContain('ERROR');
            expect(magicJs).toContain('WARN');
            expect(magicJs).toContain('INFO');
            expect(magicJs).toContain('DEBUG');
        });

        test('contains XSS protection', () => {
            expect(magicJs).toContain('escapeHtml');
        });

        test('contains search functionality', () => {
            expect(magicJs).toContain('log-search');
            expect(magicJs).toContain('searchMatches');
        });

        test('contains filter functionality', () => {
            expect(magicJs).toContain('activeFilters');
            expect(magicJs).toContain('toggleFilter');
        });

        test('contains download functionality', () => {
            expect(magicJs).toContain('download');
            expect(magicJs).toContain('data:text/plain');
        });
    });

    describe('DOM Simulation', () => {
        beforeEach(() => {
            // Set up a mock Jenkins console page
            document.body.innerHTML = `
                <div class="top-sticker-inner"></div>
                <div class="console-output">[INFO] Starting build
[ERROR] Build failed
[WARN] Deprecated API
[DEBUG] Loading config
Starting TestCase: LoginTest
[INFO] Running LoginTest
SUMMARY of TestCase [LoginTest]: PASSED
Starting TestCase: FailTest
[ERROR] Assertion failed
SUMMARY of TestCase [FailTest]: ERROR</div>
            `;
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('console-output element exists', () => {
            const consoleOutput = document.querySelector('.console-output');
            expect(consoleOutput).not.toBeNull();
        });

        test('top-sticker-inner element exists', () => {
            const sticker = document.querySelector('.top-sticker-inner');
            expect(sticker).not.toBeNull();
        });

        test('console contains expected log lines', () => {
            const content = document.querySelector('.console-output').textContent;
            expect(content).toContain('[INFO]');
            expect(content).toContain('[ERROR]');
            expect(content).toContain('Starting TestCase:');
        });
    });
});

describe('Manifest Validation', () => {
    let manifest;

    beforeAll(() => {
        const manifestPath = path.join(__dirname, '../manifest.json');
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    });

    test('has valid manifest version', () => {
        expect(manifest.manifest_version).toBe(3);
    });

    test('has required fields', () => {
        expect(manifest.name).toBeDefined();
        expect(manifest.version).toBeDefined();
        expect(manifest.description).toBeDefined();
    });

    test('has content scripts defined', () => {
        expect(manifest.content_scripts).toBeDefined();
        expect(manifest.content_scripts).toHaveLength(1);
    });

    test('content script includes required files', () => {
        const cs = manifest.content_scripts[0];
        expect(cs.js).toContain('magic.js');
        expect(cs.css).toContain('style.css');
    });

    test('matches Jenkins console URLs', () => {
        const matches = manifest.content_scripts[0].matches;
        expect(matches.some((m) => m.includes('console'))).toBe(true);
    });

    test('supports HTTPS', () => {
        const matches = manifest.content_scripts[0].matches;
        expect(matches.some((m) => m.startsWith('https://'))).toBe(true);
    });

    test('version follows semver format', () => {
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
