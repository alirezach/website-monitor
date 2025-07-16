document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_ENDPOINT = 'https://sadbarg.engare.net/scanner/api/check-now.php'; // IMPORTANT: Replace with your actual server API endpoint
    const WEBSITES = [
        { name: 'درگاه ملی آمار', url: 'https://www.amar.org.ir' },
        { name: 'مرکز آمار ایران', url: 'https://www.cbi.ir' },
        { name: 'بانک مرکزی', url: 'https://www.mimt.gov.ir' },
        { name: 'وزارت صمت', url: 'https://www.mporg.ir' },
        { name: 'سازمان برنامه و بودجه', url: 'https://www.msrt.ir' },
        { name: 'وزارت علوم', url: 'https://www.moe.gov.ir' },
        { name: 'وزارت آموزش و پرورش', url: 'https://www.mcls.gov.ir' },
        { name: 'وزارت کار', url: 'https://www.moi.ir' }
    ];

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
        const online = results.filter(r => r.status === 'Online').length;
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
            const statusClass = result.status === 'Online' ? 'status-online' : 'status-offline';
            row.innerHTML = `
                <td><a href="${result.url}" target="_blank">${result.name}</a></td>
                <td><span class="status ${statusClass}">${result.status === 'Online' ? 'آنلاین' : 'آفلاین'}</span></td>
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
        let status = 'Offline';
        let latency = null;
        let note = 'Request timed out or blocked by CORS.';

        try {
            const response = await fetch(website.url, { mode: 'no-cors', cache: 'no-store' });
            latency = Date.now() - startTime;
            // 'no-cors' responses have a status of 0, but if we get here, it means a response was received.
            status = 'Online'; 
            note = 'Response received (no-cors).';
        } catch (error) {
            // Network error or DNS failure
            status = 'Offline';
            note = 'Network error or unreachable.';
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
    async function runChecks() {
        if (isChecking) return;
        isChecking = true;

        loadingIndicator.classList.add('show');
        checkNowBtn.disabled = true;
        checkNowBtn.textContent = 'در حال بررسی...';
        websitesTableBody.innerHTML = '';

        const checkPromises = WEBSITES.map(checkWebsite);
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