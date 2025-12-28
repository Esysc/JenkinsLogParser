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

        const colors = {
            ERROR: '#F90636',
            INFO: '#061CF9',
            DEBUG: '#C906F9',
            WARN: '#F97106',
        };

        let testname = '';
        let href = '';

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
                } else {
                    el.setAttribute(key, value);
                }
            });
            children.forEach((child) => {
                if (typeof child === 'string') {
                    el.innerHTML += child;
                } else {
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
            let color = '';

            // Find matching log level color
            for (const [level, levelColor] of Object.entries(colors)) {
                if (line.includes(level)) {
                    color = levelColor;
                    break;
                }
            }

            const escapedLine = escapeHtml(line);
            const preIndex = line.indexOf(PRE_STRING);
            const postIndex = line.indexOf(POST_STRING);

            let lineHtml;
            if (preIndex !== -1) {
                testname = escapeHtml(line.substring(preIndex + PRE_STRING.length));
                href = '#test' + index;
                lineHtml = `<span class="testline" ${
                    color ? `style="color:${color}"` : ''
                } id="test${index}">${escapedLine}</span>`;
            } else {
                lineHtml = `<span class="testline" ${
                    color ? `style="color:${color}"` : ''
                }>${escapedLine}</span>`;
            }

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
        consoleOutput.innerHTML = htmlOutput.join('<br />');

        // Build navigation menu
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

        // Append menu to page
        const stickerInner = document.querySelector('.top-sticker-inner');
        if (stickerInner) {
            stickerInner.appendChild(menu);
        }

        // Download button handler
        downloadBtn.addEventListener('click', () => {
            const filename = document.title + '.txt';
            const tempElem = document.createElement('a');
            tempElem.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(consoleOut);
            tempElem.download = filename;
            tempElem.click();
        });
    }
})();
