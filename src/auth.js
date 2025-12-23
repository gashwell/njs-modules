// Authentication and Authorization Module for AI Gateway

// Validate API key from Authorization header
function validateApiKey(r) {
    var authHeader = r.headersIn['Authorization'];

    if (!authHeader) {
        r.warn('No Authorization header present');
        return false;
    }

    if (!authHeader.startsWith('Bearer ')) {
        r.warn('Invalid Authorization format - expected Bearer token');
        return false;
    }

    var apiKey = authHeader.substring(7);

    // Check minimum key length
    if (apiKey.length < 10) {
        r.warn('API key too short');
        return false;
    }

    // Check key format (sk-prefix for standard keys)
    if (!apiKey.startsWith('sk-')) {
        r.warn('Invalid API key format');
        return false;
    }

    // Check against keyval zone if available
    var isValid = r.variables.is_valid_key;
    if (isValid === '1' || isValid === 'true') {
        return true;
    }

    // Fallback: accept any properly formatted key in development
    // In production, this would strictly check the keyval zone
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    return isValid === '1';
}

// Check if user has remaining quota
function checkQuota(r) {
    var userId = extractUserId(r);

    if (!userId) {
        r.warn('Could not extract user ID for quota check');
        return true; // Allow if no user ID (will be rate limited elsewhere)
    }

    // Get quota from keyval zone
    var quotaRemaining = r.variables.quota_remaining;

    if (quotaRemaining !== undefined && quotaRemaining !== '') {
        var remaining = parseInt(quotaRemaining, 10);
        if (remaining <= 0) {
            r.warn('User ' + userId + ' has exceeded quota');
            return false;
        }
    }

    // Track request count (would decrement quota in production)
    r.variables.request_count = (parseInt(r.variables.request_count || '0', 10) + 1).toString();

    return true;
}

// Extract user ID from API key or header
function extractUserId(r) {
    var authHeader = r.headersIn['Authorization'] || '';

    if (authHeader.startsWith('Bearer sk-')) {
        // Extract user identifier from key format: sk-{tier}-{userId}-{random}
        var key = authHeader.substring(10); // Remove 'Bearer sk-'
        var parts = key.split('-');
        if (parts.length >= 2) {
            return parts[1]; // Return userId portion
        }
    }

    // Check for X-User-ID header
    var userIdHeader = r.headersIn['X-User-ID'];
    if (userIdHeader) {
        return userIdHeader;
    }

    return null;
}

// Get user's tier level
function getUserTier(r) {
    var authHeader = r.headersIn['Authorization'] || '';

    if (authHeader.indexOf('sk-premium-') !== -1) {
        return 'premium';
    } else if (authHeader.indexOf('sk-standard-') !== -1) {
        return 'standard';
    }

    // Check keyval zone for tier
    var tier = r.variables.user_tier;
    if (tier) {
        return tier;
    }

    return 'free';
}

// Rate limit check helper
function checkRateLimit(r) {
    var rateLimitRemaining = r.headersOut['X-RateLimit-Remaining'];
    if (rateLimitRemaining !== undefined) {
        return parseInt(rateLimitRemaining, 10) > 0;
    }
    return true;
}

export default { validateApiKey, checkQuota, extractUserId, getUserTier, checkRateLimit };
