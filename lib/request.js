const parse = require('./parser');

module.exports = async function(opts, buffer, cb) {
    // 1. Validation
    if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
        return Promise.reject(new Error("Data required"));
    }

    // 2. URL and Protocol Normalization
    let urlStr = typeof opts === "string" ? opts : opts.uri || opts.href;// If opts is a legacy url.parse object, reconstruct the URL
    if (typeof opts === "object" && !urlStr) {
        const protocol = (opts.protocol || 'http:').replace('ipp:', 'http:').replace('ipps:', 'https:');
        const port = opts.port || 631;
        const host = opts.hostname || opts.host || 'localhost';
        urlStr = `${protocol}//${host}:${port}${opts.path || '/'}`;
    } else {
        urlStr = urlStr.replace('ipp:', 'http:').replace('ipps:', 'https:');
    }
// 3. Header Setup
    const headers = {
        'Content-Type': 'application/ipp',
        ...(opts.headers || {})
    };

    return fetch(urlStr, {
        method: 'POST',
        headers: headers,
        body: buffer, // Fetch accepts Buffer/Uint8Array directly
        // Note: 'Expect: 100-continue' is generally ignored by Fetch
    }).then(res => {
        if (!res.ok) {
            throw new IppResponseError(res.statusCode);
        }
        return res.arrayBuffer();
    }).then(arrayBuffer => {
        const response = parse(Buffer.from(arrayBuffer));
        delete response.operation;
        return response;
    })
        .catch(err => cb(err));
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
