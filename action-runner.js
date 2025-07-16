const fetch = require('node-fetch');

// --- Configuration ---
const API_ENDPOINT = 'https://sadbarg.engare.net/scanner/api/check-now.php';
const WEBSITES_API_URL = 'https://sadbarg.engare.net/scanner/api/websites.php?server=github_external';

/**
 * Checks a single website's status.
 * @param {object} website - The website object {id, name, url}.
 */
async function checkWebsite(website) {
    const startTime = Date.now();
    let status = 'offline';
    let latency = null;
    let note = '';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

        const response = await fetch(website.url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);

        latency = Date.now() - startTime;

        if (response.ok) {
            status = 'online';
            note = `Status: ${response.status}`;
        } else {
            status = 'offline';
            note = `Error: ${response.status}`;
        }
    } catch (error) {
        latency = Date.now() - startTime;
        status = 'offline';
        if (error.name === 'AbortError') {
            note = 'Timeout';
        } else {
            note = 'Network or CORS Error';
        }
    }

    console.log(`Checked ${website.name}: ${status} (${latency}ms)`);
    return { ...website, status, latency, note };
}

/**
 * Sends the check results to the main server.
 * @param {Array} results - The array of check results.
 */
async function reportResultsToServer(results) {
    const compressedResults = results.map(r => ({
        id: r.id,
        s: r.status === 'online' ? 1 : 0,
        l: r.latency,
        n: r.note
    }));

    try {
        console.log('Sending compressed results to the server...');
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ checks: compressedResults, source: 'github_action' })
        });

        if (response.ok) {
            console.log('Results successfully reported to the server.');
        } else {
            const errorText = await response.text();
            throw new Error(`Server responded with status: ${response.status}. Body: ${errorText}`);
        }
    } catch (error) {
        console.error('Failed to report results to server:', error);
        // In a real scenario, you might want to retry or handle this failure.
    }
}

/**
 * Fetches the list of websites from the server.
 */
async function fetchWebsites() {
    try {
        console.log('Fetching website list...');
        const response = await fetch(WEBSITES_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const websites = await response.json();
        console.log(`Fetched ${websites.length} websites.`);
        return websites;
    } catch (error) {
        console.error('Failed to fetch websites:', error);
        return [];
    }
}

/**
 * Main function to run all checks.
 */
async function runChecks() {
    console.log('Starting website checks...');
    const websites = await fetchWebsites();

    if (websites.length === 0) {
        console.log('No websites to check. Exiting.');
        return;
    }

    // Run checks in parallel with a concurrency limit to avoid overwhelming the network
    const concurrencyLimit = 5;
    const results = [];
    for (let i = 0; i < websites.length; i += concurrencyLimit) {
        const chunk = websites.slice(i, i + concurrencyLimit);
        const promises = chunk.map(checkWebsite);
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
    }

    console.log('All checks completed.');
    await reportResultsToServer(results);
    console.log('Process finished.');
}

// --- Run the process ---
runChecks();