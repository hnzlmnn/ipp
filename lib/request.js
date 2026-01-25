

function normalizeIppUrl(urlStr) {
    // Handle ipp/ipps protocol conversion
    const normalizedProtocol = urlStr
        .replace(/^ipp:\/\//i, 'http://')
        .replace(/^ipps:\/\//i, 'https://');

    const url = new URL(normalizedProtocol);
    let authHeader = undefined;

    // Extract credentials for Basic Auth
    if (url.username || url.password) {
        const encoded = Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`, 'utf8').toString('base64');

        authHeader = `Basic ${encoded}`;

        // IMPORTANT: Strip credentials from the URL object
        url.username = '';
        url.password = '';
    }

    return {
        href: url.toString(), authHeader
    };
}

module.exports = function (opts, buffer) {
    // 1. Validation
    if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
        return Promise.reject(new Error("Data required"));
    }

    // 2. URL and Protocol Normalization
    let urlStr = typeof opts === "string" ? opts : opts.uri || opts.href;// If opts is a legacy url.parse object, reconstruct the URL
    if (typeof opts === "object" && !urlStr) {
        const protocol = (opts.protocol || 'http:');
        const port = opts.port || 631;
        const host = opts.hostname || opts.host || 'localhost';
        urlStr = `${protocol}//${host}:${port}${opts.path || '/'}`;
    }

    const { href, authHeader } = normalizeIppUrl(urlStr);

    // 3. Header Setup
    const headers = {
        'Content-Type': 'application/ipp', ...(opts.headers || {}), ...(authHeader ? {'Authorization': authHeader} : {}),
    };

    return fetch(href, {
        method: 'POST', headers: headers, body: buffer, // Fetch accepts Buffer/Uint8Array directly
        // Note: 'Expect: 100-continue' is generally ignored by Fetch
    }).then(res => {
        if (!res.ok) {
            throw new IppResponseError(res.status);
        }
        return res.arrayBuffer();
    })
    // No .catch() here! Let the caller handle it so it fits into your Either logic.
};

function IppResponseError(statusCode, message) {
    this.name = 'IppResponseError';
    this.statusCode = statusCode;
    this.message = message || 'Received unexpected response status ' + statusCode + ' from the printer';
    this.stack = (new Error()).stack;
}

IppResponseError.prototype = Object.create(Error.prototype);
IppResponseError.prototype.constructor = IppResponseError;
