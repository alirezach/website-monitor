document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_ENDPOINT = 'https://sadbarg.engare.net/scanner/api/check-now.php'; // IMPORTANT: Replace with your actual server API endpoint
    const WEBSITES_API_URL = 'https://sadbarg.engare.net/scanner/api/websites.php?server=iran_internal'; // Fetch internal server list

    // --- UI Elements ---
    const websitesTableBody = document.getElementById('websitesTableBody');
    const loadingIndicator = document.getElementById('loading');
    const checkNowBtn = document.getElementById('checkNowBtn');
    const lastUpdateSpan = document.getElementById('lastUpdate');
    const onlineCountSpan = document.getElementById('onlineCount');
    const offlineCountSpan = document.getElementById('offlineCount');
    const totalCountSpan = document.getElementById('totalCount');
    const connectionStatusText = document.getElementById('statusText');
    const connectionStatusIndicator = document.getElementById('statusIndicator');

    // --- State ---
    let isChecking = false;

    /**
     * Updates the statistics boxes.
     * @param {Array} results - Array of check results.
     */
    function updateStats(results) {
        const online = results.filter(r => r.status === 'online').length;
        const offline = results.length - online;
        onlineCountSpan.textContent = online;
        offlineCountSpan.textContent = offline;
        totalCountSpan.textContent = results.length;
    }

    /**
     * Renders the results in the table.
     * @param {Array} results - Array of check results.
     */
    function renderTable(results) {
        websitesTableBody.innerHTML = '';
        results.forEach(result => {
            const row = document.createElement('tr');
            const statusClass = result.status === 'online' ? 'status-online' : 'status-offline';
            row.innerHTML = `
                <td><a href="${result.url}" target="_blank">${result.name}</a></td>
                <td><span class="status ${statusClass}">${result.status === 'online' ? 'آنلاین' : 'آفلاین'}</span></td>
                <td>${new Date().toLocaleTimeString('fa-IR')}</td>
                <td>${result.latency !== null ? `${result.latency}ms` : 'N/A'}</td>
                <td>${result.note || '-'}</td>
            `;
            websitesTableBody.appendChild(row);
        });
    }

    /**
     * Checks a single website's status.
     * This uses 'no-cors' which is a simple way to check for reachability.
     * It doesn't confirm a 200 OK status but shows if the server responded.
     * @param {object} website - The website object {name, url}.
     */
    async function checkWebsite(website) {
        const startTime = Date.now();
        let status = 'offline';
        let latency = null;
        let note = '';

        try {
            const response = await fetch(website.url, { cache: 'no-store' });
            latency = Date.now() - startTime;

            if (response.ok) {
                status = 'online';
                note = `Status: ${response.status}`;
            } else {
                status = 'offline';
                note = `Error: ${response.status}`;
                try {
                    const bodyText = await response.text();
                    const lowerBodyText = bodyText.toLowerCase();
                    const hasForbiddenTitle = /<title>.*(403|forbidden).*<\/title>/i.test(bodyText);
                    if (
                        lowerBodyText.includes('عدم دسترسی') ||
                        lowerBodyText.includes('access denied') ||
                        lowerBodyText.includes('forbidden') ||
                        lowerBodyText.includes('403') ||
                        hasForbiddenTitle
                    ) {
                        note = 'دسترسی مسدود (403)';
                    } else {
                        note = `خطای سرور (${response.status})`;
                    }
                } catch (e) {
                    // Ignore if can't read body
                }
            }
        } catch (error) {
            latency = Date.now() - startTime;
            status = 'offline';
            note = 'خطای شبکه یا CORS';
        }

        return { ...website, status, latency, note };
    }

    /**
     * Sends the check results to the main server.
     * @param {Array} results - The array of check results.
     */
    async function reportResultsToServer(results) {
        try {
            connectionStatusText.textContent = 'در حال ارسال نتایج به سرور اصلی...';
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ checks: results, source: 'github' })
            });

            if (response.ok) {
                connectionStatusText.textContent = 'نتایج با موفقیت به سرور ارسال شد.';
                connectionStatusIndicator.classList.add('online');
                connectionStatusIndicator.classList.remove('offline');
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to report results to server:', error);
            connectionStatusText.textContent = 'خطا در ارسال نتایج به سرور اصلی.';
            connectionStatusIndicator.classList.add('offline');
            connectionStatusIndicator.classList.remove('online');
        }
    }

    /**
     * Main function to run all checks.
     */
    /**
     * Fetches the list of websites from the server.
     */
    async function fetchWebsites() {
        try {
            const response = await fetch(WEBSITES_API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch websites:', error);
            connectionStatusText.textContent = 'خطا در دریافت لیست وب‌سایت‌ها.';
            return []; // Return empty array on failure
        }
    }

    /**
     * Main function to run all checks.
     */
    async function runChecks() {
        if (isChecking) return;
        isChecking = true;

        loadingIndicator.classList.add('show');
        checkNowBtn.disabled = true;
        checkNowBtn.textContent = 'در حال دریافت لیست سایت‌ها...';
        websitesTableBody.innerHTML = '';

        const websites = await fetchWebsites();
        if (websites.length === 0) {
            loadingIndicator.classList.remove('show');
            checkNowBtn.disabled = false;
            checkNowBtn.textContent = '🔄 تلاش مجدد';
            isChecking = false;
            return;
        }

        checkNowBtn.textContent = 'در حال بررسی...';
        const checkPromises = websites.map(checkWebsite);
        const results = await Promise.all(checkPromises);

        renderTable(results);
        updateStats(results);
        await reportResultsToServer(results);

        lastUpdateSpan.textContent = new Date().toLocaleString('fa-IR');
        loadingIndicator.classList.remove('show');
        checkNowBtn.disabled = false;
        checkNowBtn.textContent = '🔄 بررسی فوری از سرور خارجی';
        isChecking = false;
    }

    // --- Event Listeners ---
    checkNowBtn.addEventListener('click', runChecks);

    // Initial check on page load
    runChecks();
});