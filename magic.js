(() => {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Try multiple selectors for different Jenkins views (freestyle, pipeline, blue ocean)
        const consoleOutput =
            document.querySelector('.console-output') ||
            document.querySelector('pre.console-output') ||
            document.querySelector('.pipeline-console') ||
            document.querySelector('#pipeline-console') ||
            document.querySelector('.log-body') ||
            document.querySelector('pre');

        if (!consoleOutput) return;

        // Skip if already processed
        if (consoleOutput.classList.contains('log-parser-enhanced')) return;
        consoleOutput.classList.add('log-parser-enhanced');

        const PRE_STRING = 'Starting TestCase:';
        const POST_STRING = 'SUMMARY of TestCase [';

        const LOG_LEVELS = {
            ERROR: { color: '#F90636', priority: 1 },
            WARN: { color: '#F97106', priority: 2 },
            INFO: { color: '#061CF9', priority: 3 },
            DEBUG: { color: '#C906F9', priority: 4 },
        };

        // Stats tracking
        const stats = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, total: 0 };
        let testname = '';
        let href = '';
        let activeFilters = new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER']);
        let processedLineCount = 0;
        let rawLogContent = '';

        // Helper function to escape HTML and prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Helper to create elements with attributes
        function createElement(tag, attrs = {}, children = []) {
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
        }

        // Create wrapper for parsed output
        const parsedOutput = createElement('div', { className: 'log-parser-output' });

        // Build navigation dropdown
        const uldropdown = createElement('div', { className: 'dropdown-mycontent' });
        const emptyMsg = createElement('div', { className: 'dropdown-empty' }, [
            'No test cases found',
        ]);
        uldropdown.appendChild(emptyMsg);

        // Create toolbar first (before processing any lines)
        const toolbar = createElement('div', { className: 'log-parser-toolbar' });

        // Stats summary (will be updated dynamically)
        const statsSummary = createElement('div', { className: 'log-stats', id: 'log-stats' });
        toolbar.appendChild(statsSummary);

        // Search box
        const searchBox = createElement('div', { className: 'log-search-box' }, [
            '<input type="text" id="log-search" placeholder="🔍 Search logs..." />',
            '<span id="search-results"></span>',
        ]);
        toolbar.appendChild(searchBox);

        // Filter buttons
        const filterBox = createElement('div', { className: 'log-filters' });
        ['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'].forEach((level) => {
            const btn = createElement(
                'button',
                {
                    className: 'filter-btn filter-' + level.toLowerCase() + ' active',
                    'data-level': level,
                },
                [level]
            );
            btn.addEventListener('click', () => toggleFilter(level, btn));
            filterBox.appendChild(btn);
        });
        toolbar.appendChild(filterBox);

        // Action buttons
        const actionBox = createElement('div', { className: 'log-actions' });

        // Live indicator
        const liveIndicator = createElement(
            'span',
            { className: 'live-indicator', id: 'live-indicator' },
            ['🔴 LIVE']
        );
        actionBox.appendChild(liveIndicator);

        // Expand/Collapse all
        const collapseBtn = createElement('button', { className: 'action-btn' }, ['➖ Collapse']);
        collapseBtn.addEventListener('click', () => toggleCollapseAll(true));
        actionBox.appendChild(collapseBtn);

        const expandBtn = createElement('button', { className: 'action-btn' }, ['➕ Expand']);
        expandBtn.addEventListener('click', () => toggleCollapseAll(false));
        actionBox.appendChild(expandBtn);

        // Jump to first error
        const jumpErrorBtn = createElement('button', { className: 'action-btn action-error' }, [
            '⬇️ Error',
        ]);
        jumpErrorBtn.addEventListener('click', jumpToFirstError);
        actionBox.appendChild(jumpErrorBtn);

        // Download logs button
        const downloadBtn = createElement('button', { className: 'action-btn' }, ['💾 Download']);
        actionBox.appendChild(downloadBtn);

        toolbar.appendChild(actionBox);

        // Test case navigator dropdown (integrated in toolbar)
        const dropdownBtn = createElement('button', { className: 'dropbtn action-btn' }, [
            '🗺️ Tests ▼',
        ]);
        const dropdown = createElement('div', { className: 'dropdown toolbar-dropdown' });
        dropdown.appendChild(dropdownBtn);
        dropdown.appendChild(uldropdown);
        toolbar.appendChild(dropdown);

        // Insert toolbar and parsed output container
        consoleOutput.style.display = 'none';
        consoleOutput.parentNode.insertBefore(toolbar, consoleOutput);
        consoleOutput.parentNode.insertBefore(parsedOutput, consoleOutput.nextSibling);

        // Update stats display
        function updateStats() {
            statsSummary.innerHTML =
                '<span class="stat-item stat-error">❌ ' +
                stats.ERROR +
                '</span>' +
                '<span class="stat-item stat-warn">⚠️ ' +
                stats.WARN +
                '</span>' +
                '<span class="stat-item stat-info">ℹ️ ' +
                stats.INFO +
                '</span>' +
                '<span class="stat-item stat-debug">🔍 ' +
                stats.DEBUG +
                '</span>' +
                '<span class="stat-item stat-total">�� ' +
                stats.total +
                '</span>';
        }

        // Parse a single line and return the HTML element
        function parseLine(line, index) {
            let level = 'OTHER';
            let color = '';

            // Find matching log level
            for (const [lvl, config] of Object.entries(LOG_LEVELS)) {
                if (line.includes(lvl)) {
                    level = lvl;
                    color = config.color;
                    stats[lvl]++;
                    break;
                }
            }
            stats.total++;

            const escapedLine = escapeHtml(line);
            const preIndex = line.indexOf(PRE_STRING);
            const postIndex = line.indexOf(POST_STRING);

            const lineNum = String(index + 1).padStart(5, ' ');

            let lineId = 'line-' + index;
            if (preIndex !== -1) {
                testname = escapeHtml(line.substring(preIndex + PRE_STRING.length));
                href = '#test' + index;
                lineId = 'test' + index;
            }

            const lineEl = createElement('div', {
                className: 'log-line',
                'data-level': level,
                id: lineId,
            });

            lineEl.innerHTML =
                '<span class="log-line-num">' +
                lineNum +
                '</span>' +
                '<span class="log-content testline" ' +
                (color ? 'style="color:' + color + '"' : '') +
                '>' +
                escapedLine +
                '</span>' +
                '<button class="copy-line-btn" title="Copy line">📋</button>';

            // Add to test case navigator if this is a summary line
            if (postIndex !== -1) {
                // Remove empty message if present
                const empty = uldropdown.querySelector('.dropdown-empty');
                if (empty) empty.remove();

                const menuColor = line.includes('ERROR') ? '#F90636' : '#2ACF1F';
                const menuBtn = createElement('button', {}, [
                    '<a href="' +
                        href +
                        '"><span style="color:' +
                        menuColor +
                        '">' +
                        testname +
                        '</span></a>',
                ]);
                uldropdown.appendChild(menuBtn);
            }

            // Apply current filter
            if (!activeFilters.has(level)) {
                lineEl.style.display = 'none';
            }

            return lineEl;
        }

        // Process new lines (for both initial load and live updates)
        function processNewLines() {
            const currentContent = consoleOutput.textContent;
            if (currentContent === rawLogContent) return; // No changes

            const allLines = currentContent.split('\n');
            const newLines = allLines.slice(processedLineCount);

            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();

            newLines.forEach((line, i) => {
                const index = processedLineCount + i;
                const lineEl = parseLine(line, index);
                fragment.appendChild(lineEl);
            });

            parsedOutput.appendChild(fragment);
            processedLineCount = allLines.length;
            rawLogContent = currentContent;

            updateStats();
        }

        // Initial processing
        processNewLines();

        // Set up MutationObserver for live updates
        const observer = new MutationObserver((mutations) => {
            let hasChanges = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    hasChanges = true;
                }
            });
            if (hasChanges) {
                processNewLines();
            }
        });

        observer.observe(consoleOutput, {
            childList: true,
            characterData: true,
            subtree: true,
        });

        // Also poll for changes (backup for some Jenkins setups)
        const pollInterval = setInterval(() => {
            const currentContent = consoleOutput.textContent;
            if (currentContent !== rawLogContent) {
                processNewLines();
            }
        }, 1000);

        // Check if build is complete (live indicator)
        function checkBuildStatus() {
            const progressBar = document.querySelector('.build-caption-progress-container');
            const isBuilding = progressBar !== null;
            const indicator = document.getElementById('live-indicator');
            if (indicator) {
                if (isBuilding) {
                    indicator.textContent = '🔴 LIVE';
                    indicator.style.display = '';
                } else {
                    indicator.textContent = '✅ Done';
                    indicator.classList.add('complete');
                    // Stop polling when build is complete
                    setTimeout(() => {
                        clearInterval(pollInterval);
                    }, 3000);
                }
            }
        }

        // Check build status periodically
        setInterval(checkBuildStatus, 2000);
        checkBuildStatus();

        // Download button handler
        downloadBtn.addEventListener('click', () => {
            const filename = document.title + '.txt';
            const tempElem = document.createElement('a');
            tempElem.href =
                'data:text/plain;charset=utf-8,' + encodeURIComponent(consoleOutput.textContent);
            tempElem.download = filename;
            tempElem.click();
        });

        // Search functionality
        const searchInput = document.getElementById('log-search');
        const searchResults = document.getElementById('search-results');
        let searchMatches = [];
        let currentMatchIndex = -1;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            clearSearchHighlights();

            if (query.length < 2) {
                searchResults.textContent = '';
                searchMatches = [];
                return;
            }

            searchMatches = [];
            parsedOutput.querySelectorAll('.log-line').forEach((line) => {
                const content = line.querySelector('.log-content');
                if (content && content.textContent.toLowerCase().includes(query)) {
                    line.classList.add('search-match');
                    searchMatches.push(line);
                }
            });

            searchResults.textContent = searchMatches.length + ' matches';
            currentMatchIndex = searchMatches.length > 0 ? 0 : -1;
            if (currentMatchIndex >= 0) {
                highlightCurrentMatch();
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && searchMatches.length > 0) {
                e.preventDefault();
                currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
                highlightCurrentMatch();
            }
        });

        function clearSearchHighlights() {
            parsedOutput.querySelectorAll('.log-line.search-match').forEach((el) => {
                el.classList.remove('search-match', 'current-match');
            });
        }

        function highlightCurrentMatch() {
            parsedOutput.querySelectorAll('.log-line.current-match').forEach((el) => {
                el.classList.remove('current-match');
            });
            if (searchMatches[currentMatchIndex]) {
                searchMatches[currentMatchIndex].classList.add('current-match');
                searchMatches[currentMatchIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
                searchResults.textContent = currentMatchIndex + 1 + '/' + searchMatches.length;
            }
        }

        // Filter functionality
        function toggleFilter(level, btn) {
            btn.classList.toggle('active');
            if (activeFilters.has(level)) {
                activeFilters.delete(level);
            } else {
                activeFilters.add(level);
            }
            applyFilters();
        }

        function applyFilters() {
            parsedOutput.querySelectorAll('.log-line').forEach((line) => {
                const level = line.dataset.level;
                if (activeFilters.has(level)) {
                    line.style.display = '';
                } else {
                    line.style.display = 'none';
                }
            });
        }

        // Collapse/Expand
        function toggleCollapseAll(collapse) {
            const debugInfoLines = parsedOutput.querySelectorAll(
                '.log-line[data-level="DEBUG"], .log-line[data-level="INFO"]'
            );
            debugInfoLines.forEach((line) => {
                line.style.display = collapse ? 'none' : '';
            });
            if (collapse) {
                activeFilters.delete('DEBUG');
                activeFilters.delete('INFO');
                document
                    .querySelectorAll(
                        '.filter-btn[data-level="DEBUG"], .filter-btn[data-level="INFO"]'
                    )
                    .forEach((btn) => btn.classList.remove('active'));
            } else {
                activeFilters.add('DEBUG');
                activeFilters.add('INFO');
                document
                    .querySelectorAll(
                        '.filter-btn[data-level="DEBUG"], .filter-btn[data-level="INFO"]'
                    )
                    .forEach((btn) => btn.classList.add('active'));
            }
        }

        // Jump to first error
        function jumpToFirstError() {
            const firstError = parsedOutput.querySelector('.log-line[data-level="ERROR"]');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.classList.add('highlight-flash');
                setTimeout(() => firstError.classList.remove('highlight-flash'), 2000);
            }
        }

        // Copy line functionality
        parsedOutput.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-line-btn')) {
                const line = e.target.closest('.log-line');
                const content = line.querySelector('.log-content').textContent;
                navigator.clipboard.writeText(content).then(() => {
                    e.target.textContent = '✅';
                    setTimeout(() => {
                        e.target.textContent = '📋';
                    }, 1500);
                });
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                if (document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                    searchInput.focus();
                }
            }
            // Escape to clear search
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                searchInput.blur();
            }
        });
    }
})();
