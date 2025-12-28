(() => {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const consoleOutput = document.querySelector('.console-output');
        if (!consoleOutput) return;

        const consoleOut = consoleOutput.textContent;
        const logLines = consoleOut.split('\n');

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

        // Build navigation dropdown
        const uldropdown = createElement('div', { className: 'dropdown-mycontent' });

        // Build HTML output array for performance
        const htmlOutput = [];

        logLines.forEach((line, index) => {
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
            const lineNumSpan = `<span class="log-line-num">${lineNum}</span>`;

            let lineId = `line-${index}`;
            if (preIndex !== -1) {
                testname = escapeHtml(line.substring(preIndex + PRE_STRING.length));
                href = '#test' + index;
                lineId = `test${index}`;
            }

            const lineHtml = `<div class="log-line" data-level="${level}" id="${lineId}">
                ${lineNumSpan}
                <span class="log-content testline" ${
                    color ? `style="color:${color}"` : ''
                }>${escapedLine}</span>
                <button class="copy-line-btn" title="Copy line">📋</button>
            </div>`;

            if (postIndex !== -1) {
                const menuColor = line.includes('ERROR') ? '#F90636' : '#2ACF1F';
                const menuBtn = createElement('button', {}, [
                    `<a href="${href}"><span style="color:${menuColor}">${testname}</span></a>`,
                ]);
                uldropdown.appendChild(menuBtn);
            }

            htmlOutput.push(lineHtml);
        });

        // Update console output in one operation
        consoleOutput.innerHTML = htmlOutput.join('');
        consoleOutput.classList.add('log-parser-enhanced');

        // Create toolbar
        const toolbar = createElement('div', { className: 'log-parser-toolbar' });

        // Stats summary
        const statsSummary = createElement('div', { className: 'log-stats' }, [
            `<span class="stat-item stat-error">❌ ${stats.ERROR} errors</span>`,
            `<span class="stat-item stat-warn">⚠️ ${stats.WARN} warnings</span>`,
            `<span class="stat-item stat-info">ℹ️ ${stats.INFO} info</span>`,
            `<span class="stat-item stat-debug">🔍 ${stats.DEBUG} debug</span>`,
            `<span class="stat-item stat-total">📝 ${stats.total} total</span>`,
        ]);
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
                    className: `filter-btn filter-${level.toLowerCase()} active`,
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

        // Expand/Collapse all
        const collapseBtn = createElement('button', { className: 'action-btn' }, [
            '➖ Collapse All',
        ]);
        collapseBtn.addEventListener('click', () => toggleCollapseAll(true));
        actionBox.appendChild(collapseBtn);

        const expandBtn = createElement('button', { className: 'action-btn' }, ['➕ Expand All']);
        expandBtn.addEventListener('click', () => toggleCollapseAll(false));
        actionBox.appendChild(expandBtn);

        // Jump to first error
        const jumpErrorBtn = createElement('button', { className: 'action-btn action-error' }, [
            '⬇️ First Error',
        ]);
        jumpErrorBtn.addEventListener('click', jumpToFirstError);
        actionBox.appendChild(jumpErrorBtn);

        toolbar.appendChild(actionBox);

        // Build navigation menu (existing)
        const dropdownBtn = createElement('button', { className: 'dropbtn' }, [
            'Tests Cases Navigator <i class="fa fa-caret-down"></i>',
        ]);

        const dropdown = createElement('div', { className: 'dropdown' });
        dropdown.appendChild(dropdownBtn);
        dropdown.appendChild(uldropdown);

        const downloadBtn = createElement('button', { className: 'download btn button' }, [
            'Download logs',
        ]);

        const menu = createElement('div', { className: 'topnav', id: 'myTopnav' });
        menu.appendChild(dropdown);
        menu.appendChild(downloadBtn);

        // Append menu and toolbar to page
        const stickerInner = document.querySelector('.top-sticker-inner');
        if (stickerInner) {
            stickerInner.appendChild(menu);
            stickerInner.appendChild(toolbar);
        }

        // Download button handler
        downloadBtn.addEventListener('click', () => {
            const filename = document.title + '.txt';
            const tempElem = document.createElement('a');
            tempElem.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(consoleOut);
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
            document.querySelectorAll('.log-line').forEach((line) => {
                const content = line.querySelector('.log-content');
                if (content && content.textContent.toLowerCase().includes(query)) {
                    line.classList.add('search-match');
                    searchMatches.push(line);
                }
            });

            searchResults.textContent = `${searchMatches.length} matches`;
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
            document.querySelectorAll('.log-line.search-match').forEach((el) => {
                el.classList.remove('search-match', 'current-match');
            });
        }

        function highlightCurrentMatch() {
            document.querySelectorAll('.log-line.current-match').forEach((el) => {
                el.classList.remove('current-match');
            });
            if (searchMatches[currentMatchIndex]) {
                searchMatches[currentMatchIndex].classList.add('current-match');
                searchMatches[currentMatchIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
                searchResults.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
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
            document.querySelectorAll('.log-line').forEach((line) => {
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
            const debugInfoLines = document.querySelectorAll(
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
                    .forEach((btn) => {
                        btn.classList.remove('active');
                    });
            } else {
                activeFilters.add('DEBUG');
                activeFilters.add('INFO');
                document
                    .querySelectorAll(
                        '.filter-btn[data-level="DEBUG"], .filter-btn[data-level="INFO"]'
                    )
                    .forEach((btn) => {
                        btn.classList.add('active');
                    });
            }
        }

        // Jump to first error
        function jumpToFirstError() {
            const firstError = document.querySelector('.log-line[data-level="ERROR"]');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.classList.add('highlight-flash');
                setTimeout(() => firstError.classList.remove('highlight-flash'), 2000);
            }
        }

        // Copy line functionality
        consoleOutput.addEventListener('click', (e) => {
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
                // Only if not already in an input
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
