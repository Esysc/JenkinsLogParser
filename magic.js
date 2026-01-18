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

        // Navigation patterns for detecting stages, steps, and test cases
        const NAVIGATION_PATTERNS = [
            // Test case patterns
            {
                start: /Starting TestCase:\s*(.+)$/i,
                end: /SUMMARY of TestCase \[([^\]]+)\]:\s*(\w+)/i,
                type: 'test',
                icon: '🧪',
            },
            // Pipeline stage patterns
            {
                start: /^\[Pipeline\]\s+stage\s*\(?['"]?(.+?)['"]?\)?/i,
                end: /^\[Pipeline\]\s+\/\s*stage/i,
                type: 'stage',
                icon: '📦',
            },
            {
                start: /^Stage\s+['"]?(.+?)['"]?\s+started/i,
                end: /^Stage\s+['"]?(.+?)['"]?\s+(completed|failed)/i,
                type: 'stage',
                icon: '📦',
            },
            { start: /^\[(.+?)\]\s+Stage/i, end: null, type: 'stage', icon: '📦' },
            // Maven/Gradle test patterns
            {
                start: /^Running\s+(.+)$/i,
                end: /^Tests run:\s*\d+.*?in\s+(.+)$/i,
                type: 'test',
                icon: '🧪',
            },
            // JUnit patterns
            {
                start: /^Test:\s+(.+)$/i,
                end: /^Test\s+(.+?)\s+(PASSED|FAILED)/i,
                type: 'test',
                icon: '🧪',
            },
            // Generic step patterns
            {
                start: /^\[Pipeline\]\s+\{\s*\((.+?)\)/i,
                end: /^\[Pipeline\]\s+\}/i,
                type: 'step',
                icon: '⚙️',
            },
            { start: /^\+\s+(.+)$/i, end: null, type: 'step', icon: '⚙️' },
        ];

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
        let currentNavType = null;
        let currentNavIcon = null;
        let activeFilters = new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER']);
        let processedLineCount = 0;
        let rawLogContent = '';
        let autoFollowEnabled = true;
        let followBtn = null;
        let fullLogBtn = null;
        let fullLogUrl = '';
        let rawLogUrl = '';
        let isStreamingFullLog = false;
        const SCROLL_THRESHOLD_PX = 150;
        const BASE_CHUNK_SIZE = 500;
        const MAX_RENDER_SLICE_MS = 50;
        const STATS_UPDATE_THROTTLE_MS = 200;
        let pendingRenderQueue = [];
        let lastStatsUpdate = 0;
        let chunkRenderScheduled = false;
        let pendingAutoScroll = false;
        let observer = null;
        let pollInterval = null;

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

        function isNearBottom() {
            // Check if scrolling within the log container
            const container = parsedOutput;
            const scrollPosition = container.scrollTop + container.clientHeight;
            return container.scrollHeight - scrollPosition <= SCROLL_THRESHOLD_PX;
        }

        function scrollToBottom(forceInstant = false) {
            // Scroll the log container instead of the window
            const behavior =
                forceInstant || parsedOutput.childElementCount > 5000 ? 'auto' : 'smooth';
            parsedOutput.scrollTo({
                top: parsedOutput.scrollHeight,
                behavior: behavior,
            });
        }

        const scheduleChunkCallback =
            typeof globalThis.requestIdleCallback === 'function'
                ? (cb) => globalThis.requestIdleCallback(cb, { timeout: 100 })
                : (cb) =>
                      globalThis.requestAnimationFrame(() =>
                          cb({
                              timeRemaining: () => MAX_RENDER_SLICE_MS,
                          })
                      );

        function scheduleChunkRender() {
            if (chunkRenderScheduled || pendingRenderQueue.length === 0) return;
            chunkRenderScheduled = true;
            scheduleChunkCallback((deadline) => {
                chunkRenderScheduled = false;
                renderChunk(deadline);
            });
        }

        function renderChunk(deadline) {
            if (pendingRenderQueue.length === 0) return;
            const fragment = document.createDocumentFragment();
            let processedEntries = 0;
            const startTime = performance.now();
            const timeBudget =
                deadline && typeof deadline.timeRemaining === 'function'
                    ? deadline.timeRemaining()
                    : MAX_RENDER_SLICE_MS;
            const effectiveBudget = Math.max(4, timeBudget);
            while (pendingRenderQueue.length && processedEntries < BASE_CHUNK_SIZE) {
                const { line, index } = pendingRenderQueue.shift();
                const lineEl = parseLine(line, index);
                fragment.appendChild(lineEl);
                processedEntries++;
                if (performance.now() - startTime >= effectiveBudget) {
                    break;
                }
            }

            if (fragment.childNodes.length) {
                parsedOutput.appendChild(fragment);

                // Throttle stats updates to reduce reflows
                const now = performance.now();
                if (
                    now - lastStatsUpdate > STATS_UPDATE_THROTTLE_MS ||
                    pendingRenderQueue.length === 0
                ) {
                    updateStats();
                    lastStatsUpdate = now;
                }

                if (pendingAutoScroll && autoFollowEnabled && pendingRenderQueue.length === 0) {
                    scrollToBottom(true); // Force instant scroll for better performance
                }
            }

            if (pendingRenderQueue.length) {
                scheduleChunkRender();
            } else {
                pendingAutoScroll = false;
            }
        }

        function resetParsedState() {
            parsedOutput.innerHTML = '';
            Object.keys(stats).forEach((key) => {
                stats[key] = 0;
            });
            testname = '';
            href = '';
            processedLineCount = 0;
            rawLogContent = '';
            pendingRenderQueue = [];
            chunkRenderScheduled = false;
            pendingAutoScroll = false;
            uldropdown.innerHTML = '';
            uldropdown.appendChild(emptyMsg);
            updateStats();
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

        // Add loading spinner
        const spinner = createElement('div', { className: 'log-spinner' }, [
            '<div class="spinner-icon"></div>',
            '<span class="spinner-text">Processing logs...</span>',
        ]);
        toolbar.appendChild(spinner);

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
                    title: 'Toggle ' + level + ' lines',
                },
                [level]
            );
            btn.addEventListener('click', () => toggleFilter(level, btn));
            filterBox.appendChild(btn);
        });
        toolbar.appendChild(filterBox);

        // Action buttons
        const actionBox = createElement('div', { className: 'log-actions' });

        // Multi-copy button
        const selectedLines = new Set();
        let lastSelectedLine = null;
        const copySelectedBtn = createElement(
            'button',
            { className: 'action-btn', title: 'Copy all selected lines', disabled: true },
            ['📑 Copy selected (0)']
        );
        const updateCopySelectedState = () => {
            copySelectedBtn.textContent = '📑 Copy selected (' + selectedLines.size + ')';
            copySelectedBtn.disabled = selectedLines.size === 0;
        };

        const setLineSelection = (line, selected) => {
            const checkbox = line.querySelector('.select-line-checkbox');
            if (checkbox) {
                checkbox.checked = selected;
            }
            if (selected) {
                selectedLines.add(line);
                line.classList.add('selected');
            } else {
                selectedLines.delete(line);
                line.classList.remove('selected');
            }
            updateCopySelectedState();
        };

        const toggleLineSelection = (line) => {
            setLineSelection(line, !selectedLines.has(line));
        };
        copySelectedBtn.addEventListener('click', () => {
            if (!selectedLines.size) return;
            const ordered = Array.from(selectedLines).sort(
                (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
            );
            const text = ordered
                .map((el) => el.querySelector('.log-content').textContent)
                .join('\n');
            navigator.clipboard.writeText(text).then(() => {
                const prev = copySelectedBtn.textContent;
                copySelectedBtn.textContent = '✅ Copied (' + selectedLines.size + ')';
                setTimeout(() => {
                    copySelectedBtn.textContent = prev;
                }, 1500);
            });
        });
        actionBox.appendChild(copySelectedBtn);

        // Live indicator
        const liveIndicator = createElement(
            'span',
            { className: 'live-indicator', id: 'live-indicator', title: 'Build status' },
            ['🔴 LIVE']
        );
        actionBox.appendChild(liveIndicator);

        // Expand/Collapse all
        const collapseBtn = createElement(
            'button',
            { className: 'action-btn', title: 'Hide INFO and DEBUG lines' },
            ['➖ Collapse']
        );
        collapseBtn.addEventListener('click', () => toggleCollapseAll(true));
        actionBox.appendChild(collapseBtn);

        const expandBtn = createElement(
            'button',
            { className: 'action-btn', title: 'Show INFO and DEBUG lines' },
            ['➕ Expand']
        );
        expandBtn.addEventListener('click', () => toggleCollapseAll(false));
        actionBox.appendChild(expandBtn);

        // Jump to first error
        const jumpErrorBtn = createElement(
            'button',
            { className: 'action-btn action-error', title: 'Scroll to first ERROR line' },
            ['⬇️ Error']
        );
        jumpErrorBtn.addEventListener('click', jumpToFirstError);
        actionBox.appendChild(jumpErrorBtn);

        // Download logs button
        const downloadBtn = createElement(
            'button',
            { className: 'action-btn', title: 'Download console output as text file' },
            ['💾 Download']
        );
        actionBox.appendChild(downloadBtn);

        followBtn = createElement(
            'button',
            {
                className: 'action-btn action-follow active',
                id: 'follow-toggle',
                title: 'Auto-scroll enabled',
            },
            ['📡 Follow']
        );
        followBtn.addEventListener('click', () => {
            autoFollowEnabled = !autoFollowEnabled;
            updateFollowButton();
            if (autoFollowEnabled) {
                scrollToBottom(true);
            }
        });
        actionBox.appendChild(followBtn);
        updateFollowButton();

        fullLogBtn = createElement(
            'button',
            {
                className: 'action-btn action-full-log',
                style: 'display:none;',
                title: 'Stream entire log safely',
            },
            ['📜 Full Log']
        );
        fullLogBtn.addEventListener('click', () => {
            if (!fullLogUrl || isStreamingFullLog) return;
            loadFullLogSafely();
        });
        actionBox.appendChild(fullLogBtn);

        toolbar.appendChild(actionBox);

        // Navigation dropdown (integrated in toolbar)
        const dropdownBtn = createElement(
            'button',
            { className: 'dropbtn action-btn', title: 'Navigate to stages, steps, and test cases' },
            ['🗺️ Navigator ▼']
        );
        const dropdown = createElement('div', { className: 'dropdown toolbar-dropdown' });
        dropdown.appendChild(dropdownBtn);
        dropdown.appendChild(uldropdown);
        toolbar.appendChild(dropdown);

        // Insert toolbar and parsed output container
        consoleOutput.style.display = 'none';
        consoleOutput.parentNode.insertBefore(toolbar, consoleOutput);
        consoleOutput.parentNode.insertBefore(parsedOutput, consoleOutput.nextSibling);

        initFullLogOverride();

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

        function updateFollowButton() {
            if (!followBtn) return;
            if (autoFollowEnabled) {
                followBtn.classList.add('active');
                followBtn.textContent = '📡 Follow';
                followBtn.title = 'Auto-scroll enabled';
            } else {
                followBtn.classList.remove('active');
                followBtn.textContent = '⏸️ Follow';
                followBtn.title = 'Auto-scroll paused';
            }
        }

        function initFullLogOverride() {
            if (!fullLogBtn) return;
            const fullLinks = Array.from(document.querySelectorAll('a[href*="consoleFull"]'));
            const textLinks = Array.from(document.querySelectorAll('a[href*="consoleText"]'));

            if (!fullLinks.length && !textLinks.length) return;

            if (fullLinks.length) {
                fullLogUrl = fullLinks[0].href;
                fullLinks.forEach((link) => {
                    link.dataset.logParserHidden = 'true';
                    link.style.display = 'none';
                });
            }

            if (textLinks.length) {
                rawLogUrl = textLinks[0].href;
                textLinks.forEach((link) => {
                    link.dataset.logParserHidden = 'true';
                    link.style.display = 'none';
                });
            } else if (fullLogUrl) {
                rawLogUrl = fullLogUrl.replace('consoleFull', 'consoleText');
            }

            if (!fullLogUrl && rawLogUrl) {
                fullLogUrl = rawLogUrl;
            }

            if (!fullLogUrl) return;

            fullLogBtn.style.display = '';
            fullLogBtn.disabled = false;
        }

        function prepareFullLogLoad() {
            if (!fullLogUrl || !fullLogBtn) {
                openRawLogFallback();
                return false;
            }
            ensureAutoFollowEnabled();
            return true;
        }

        function openRawLogFallback() {
            if (rawLogUrl) {
                globalThis.open(rawLogUrl, '_blank', 'noopener');
            }
        }

        function ensureAutoFollowEnabled() {
            if (!autoFollowEnabled) {
                autoFollowEnabled = true;
                updateFollowButton();
            }
        }

        function setFullLogButtonState(label, disabled) {
            if (!fullLogBtn) return;
            fullLogBtn.textContent = label;
            fullLogBtn.disabled = disabled;
        }

        function disconnectObserverIfNeeded() {
            if (observer) {
                observer.disconnect();
            }
        }

        function reconnectObserverIfNeeded() {
            if (observer) {
                observer.observe(consoleOutput, observerConfig);
            }
        }

        async function fetchAndStreamFullLog() {
            resetParsedState();
            consoleOutput.textContent = '';

            const response = await fetch(fullLogUrl, { credentials: 'include' });
            if (!response.ok || !response.body) {
                throw new Error('HTTP ' + response.status);
            }

            await streamResponseBody(response.body.getReader());
        }

        async function streamResponseBody(reader) {
            const decoder = new TextDecoder();
            for (;;) {
                const { value, done } = await reader.read();
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    if (chunk) {
                        consoleOutput.textContent += chunk;
                        processNewLines();
                    }
                }
                if (done) break;
            }
        }

        function handleFullLogError(error) {
            console.error('Failed to load full log', error);
            const fallbackPrompt = rawLogUrl ? '\nOpen consoleText instead?' : '';
            if (globalThis.confirm('Failed to load full log: ' + error.message + fallbackPrompt)) {
                openRawLogFallback();
            }
        }

        function finalizeFullLogLoad(originalLabel) {
            isStreamingFullLog = false;
            setFullLogButtonState(originalLabel, false);
            reconnectObserverIfNeeded();
        }

        async function loadFullLogSafely() {
            if (!prepareFullLogLoad()) {
                return;
            }

            const originalLabel = fullLogBtn.textContent;
            setFullLogButtonState('⌛ Loading...', true);
            isStreamingFullLog = true;

            disconnectObserverIfNeeded();

            try {
                await fetchAndStreamFullLog();
            } catch (error) {
                handleFullLogError(error);
            } finally {
                finalizeFullLogLoad(originalLabel);
            }
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

            // Check for navigation markers (stages, steps, tests)
            // Only process navigation if line contains potential markers (performance optimization)
            let navStart = null;
            let navEnd = null;
            const hasMarkers =
                line.includes('[') ||
                line.includes('Test') ||
                line.includes('Stage') ||
                line.includes('Running') ||
                line.includes('SUMMARY');

            if (hasMarkers) {
                for (const pattern of NAVIGATION_PATTERNS) {
                    const startMatch = line.match(pattern.start);
                    if (startMatch) {
                        navStart = {
                            pattern,
                            name: startMatch[1] ? startMatch[1].trim() : line.trim(),
                        };
                        break;
                    }
                }
                if (!navStart && testname) {
                    // Check for end pattern
                    for (const pattern of NAVIGATION_PATTERNS) {
                        if (pattern.end) {
                            const endMatch = line.match(pattern.end);
                            if (endMatch) {
                                navEnd = {
                                    pattern,
                                    passed:
                                        !line.includes('ERROR') &&
                                        !line.includes('FAILED') &&
                                        !line.includes('failed'),
                                };
                                break;
                            }
                        }
                    }
                }
            }

            const lineNum = String(index + 1).padStart(5, ' ');

            let lineId = 'line-' + index;
            if (navStart) {
                testname = escapeHtml(navStart.name);
                href = '#test' + index;
                lineId = 'test' + index;
                currentNavType = navStart.pattern.type;
                currentNavIcon = navStart.pattern.icon;
            }

            const lineEl = createElement('div', {
                className: 'log-line',
                'data-level': level,
                id: lineId,
            });

            lineEl.innerHTML =
                '<input type="checkbox" class="select-line-checkbox" title="Select line" />' +
                '<span class="log-line-num">' +
                lineNum +
                '</span>' +
                '<span class="log-content testline" ' +
                (color ? 'style="color:' + color + '"' : '') +
                '>' +
                escapedLine +
                '</span>' +
                '<button class="copy-line-btn" title="Copy line">📋</button>';

            // Add to navigator if this is an end line
            if (navEnd) {
                // Remove empty message if present
                const empty = uldropdown.querySelector('.dropdown-empty');
                if (empty) empty.remove();

                const menuColor = navEnd.passed ? '#2ACF1F' : '#F90636';
                const icon = currentNavIcon || '📍';
                const menuBtn = createElement('button', {}, [
                    '<a href="' +
                        href +
                        '">' +
                        icon +
                        ' <span style="color:' +
                        menuColor +
                        '">' +
                        testname +
                        '</span></a>',
                ]);
                uldropdown.appendChild(menuBtn);
                testname = '';
                currentNavType = null;
                currentNavIcon = null;
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

            if (newLines.length === 0) {
                rawLogContent = currentContent;
                processedLineCount = allLines.length;
                return;
            }

            newLines.forEach((line, i) => {
                pendingRenderQueue.push({ line, index: processedLineCount + i });
            });

            processedLineCount = allLines.length;
            rawLogContent = currentContent;

            if (autoFollowEnabled && isNearBottom()) {
                pendingAutoScroll = true;
            }

            scheduleChunkRender();
        }

        // Initial processing
        processNewLines();

        // Hide spinner after initial load
        setTimeout(() => {
            spinner.style.display = 'none';
        }, 500);

        // Set up MutationObserver for live updates
        const observerConfig = {
            childList: true,
            characterData: true,
            subtree: true,
        };

        let mutationDebounceTimer = null;
        observer = new MutationObserver((mutations) => {
            if (isStreamingFullLog) return;

            // Debounce rapid mutations to avoid excessive processing
            if (mutationDebounceTimer) {
                clearTimeout(mutationDebounceTimer);
            }

            mutationDebounceTimer = setTimeout(() => {
                let hasChanges = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        hasChanges = true;
                    }
                });
                if (hasChanges) {
                    processNewLines();
                }
                mutationDebounceTimer = null;
            }, 100);
        });

        observer.observe(consoleOutput, observerConfig);

        // Also poll for changes (backup for some Jenkins setups)
        // Dynamically adjust poll rate based on log size for better performance
        let pollRate = 1000;
        pollInterval = setInterval(() => {
            if (isStreamingFullLog) return;
            const currentContent = consoleOutput.textContent;
            if (currentContent !== rawLogContent) {
                processNewLines();
                // Reduce polling frequency for very large logs
                const lineCount = parsedOutput.childElementCount;
                if (lineCount > 10000 && pollRate === 1000) {
                    clearInterval(pollInterval);
                    pollRate = 2000;
                    pollInterval = setInterval(arguments.callee, pollRate);
                }
            }
        }, pollRate);

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
                if (content?.textContent?.toLowerCase()?.includes(query)) {
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

        // Copy + multi-select functionality
        parsedOutput.addEventListener('click', (e) => {
            const line = e.target.closest('.log-line');

            // Individual copy
            if (e.target.classList.contains('copy-line-btn')) {
                const content = line.querySelector('.log-content').textContent;
                navigator.clipboard.writeText(content).then(() => {
                    e.target.textContent = '✅';
                    setTimeout(() => {
                        e.target.textContent = '📋';
                    }, 1500);
                });
                return;
            }

            // Checkbox selection
            if (e.target.classList.contains('select-line-checkbox')) {
                setLineSelection(line, e.target.checked);
                lastSelectedLine = line;
                return;
            }

            // Click anywhere on line toggles selection; Shift+click selects range
            if (line && !e.target.closest('.copy-line-btn')) {
                if (e.shiftKey && lastSelectedLine) {
                    const lines = Array.from(parsedOutput.querySelectorAll('.log-line'));
                    const start = lines.indexOf(lastSelectedLine);
                    const end = lines.indexOf(line);
                    if (start !== -1 && end !== -1) {
                        const [s, eIdx] = start < end ? [start, end] : [end, start];
                        for (let i = s; i <= eIdx; i++) {
                            setLineSelection(lines[i], true);
                        }
                    }
                } else {
                    toggleLineSelection(line);
                }
                lastSelectedLine = line;
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

            // Arrow key navigation with Alt modifier
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                const navigationItems = Array.from(uldropdown.querySelectorAll('button a'));
                const errorLines = Array.from(
                    parsedOutput.querySelectorAll('.log-line[data-level="ERROR"]')
                );
                const allNavigableLines = [
                    ...Array.from(parsedOutput.querySelectorAll('.log-line[id^="test"]')),
                    ...errorLines,
                ].sort((a, b) => {
                    const aTop = a.getBoundingClientRect().top;
                    const bTop = b.getBoundingClientRect().top;
                    return aTop - bTop;
                });

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    // Jump to next stage/error
                    const currentScroll = window.scrollY;
                    const nextItem = allNavigableLines.find((line) => {
                        const rect = line.getBoundingClientRect();
                        return rect.top > 100; // Find next item below current viewport
                    });
                    if (nextItem) {
                        nextItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        nextItem.classList.add('highlight-flash');
                        setTimeout(() => nextItem.classList.remove('highlight-flash'), 2000);
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    // Jump to previous stage/error
                    const currentScroll = window.scrollY;
                    const prevItem = allNavigableLines.reverse().find((line) => {
                        const rect = line.getBoundingClientRect();
                        return rect.bottom < window.innerHeight - 100;
                    });
                    if (prevItem) {
                        prevItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        prevItem.classList.add('highlight-flash');
                        setTimeout(() => prevItem.classList.remove('highlight-flash'), 2000);
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    // Collapse (hide DEBUG and INFO)
                    toggleCollapseAll(true);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    // Expand (show all)
                    toggleCollapseAll(false);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    // Jump to first stage/error
                    if (allNavigableLines.length > 0) {
                        const firstItem = allNavigableLines[0];
                        firstItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        firstItem.classList.add('highlight-flash');
                        setTimeout(() => firstItem.classList.remove('highlight-flash'), 2000);
                    }
                } else if (e.key === 'End') {
                    e.preventDefault();
                    // Jump to last stage/error
                    if (allNavigableLines.length > 0) {
                        const lastItem = allNavigableLines[allNavigableLines.length - 1];
                        lastItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        lastItem.classList.add('highlight-flash');
                        setTimeout(() => lastItem.classList.remove('highlight-flash'), 2000);
                    }
                }
            }
        });

        // Add keyboard shortcuts help button
        const helpButton = createElement(
            'button',
            {
                className: 'action-btn',
                title: 'Keyboard Shortcuts (press ? to toggle)',
                style: 'margin-left: 10px;',
            },
            ['⌨️ Shortcuts']
        );

        const helpTooltip = createElement('div', {
            className: 'keyboard-help-tooltip',
            style: 'display:none;',
        });
        helpTooltip.innerHTML = `
            <strong>⌨️ KEYBOARD SHORTCUTS</strong><br><br>
            <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> &nbsp; Navigate stages/errors<br>
            <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> &nbsp; Collapse/Expand sections<br>
            <kbd>Alt</kbd> + <kbd>Home</kbd> / <kbd>End</kbd> &nbsp; Jump to first/last<br>
            <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>F</kbd> &nbsp; Search logs<br>
            <kbd>Esc</kbd> &nbsp; Clear search<br>
            <kbd>?</kbd> &nbsp; Toggle this help
        `;
        document.body.appendChild(helpTooltip);

        // Toggle help with button click or ? key
        let helpVisible = false;
        const toggleHelp = () => {
            helpVisible = !helpVisible;
            helpTooltip.style.display = helpVisible ? 'block' : 'none';
        };

        helpButton.addEventListener('click', toggleHelp);

        document.addEventListener('keydown', (e) => {
            if (e.key === '?' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                toggleHelp();
            }
        });

        toolbar.appendChild(helpButton);
    }
})();
