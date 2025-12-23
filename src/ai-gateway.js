// AI Gateway NJS Module
// Intelligent routing based on prompt length and user tier

var auth = require('auth.js');

// Model configurations
var MODELS = {
    'gpt-4': { upstream: 'openai', maxTokens: 8192, tier: 'premium' },
    'gpt-3.5-turbo': { upstream: 'openai', maxTokens: 4096, tier: 'standard' },
    'claude-3-sonnet': { upstream: 'anthropic', maxTokens: 200000, tier: 'premium' },
    'llama2': { upstream: 'ollama', maxTokens: 4096, tier: 'free' }
};

function routeRequest(r) {
    try {
        // Validate API key
        if (!auth.validateApiKey(r)) {
            r.return(401, JSON.stringify({
                error: 'Unauthorized',
                message: 'Invalid or missing API key'
            }));
            return;
        }

        // Check quota
        if (!auth.checkQuota(r)) {
            r.return(429, JSON.stringify({
                error: 'Quota exceeded',
                message: 'You have exceeded your API quota'
            }));
            return;
        }

        var body = JSON.parse(r.requestText);
        var prompt = extractPrompt(body);
        var userTier = getUserTier(r);
        var requestedModel = body.model || '';

        r.log('Request - Prompt length: ' + prompt.length + ', User tier: ' + userTier);

        // Select model based on prompt length and user tier
        var selection = selectModel(prompt, userTier, requestedModel);
        var model = selection.model;
        var upstream = selection.upstream;

        r.log('Routing to: ' + model + ' via ' + upstream);

        // Set variables for upstream routing
        r.variables.target_model = model;
        r.variables.target_upstream = upstream;

        // Build the proxied request
        var proxyBody = JSON.stringify({
            model: model,
            messages: body.messages || [{ role: 'user', content: prompt }],
            max_tokens: body.max_tokens || 1024,
            temperature: body.temperature || 0.7,
            stream: body.stream || false
        });

        r.headersOut['Content-Type'] = 'application/json';
        r.headersOut['X-Routed-Model'] = model;
        r.headersOut['X-Upstream'] = upstream;

        // Proxy to the selected upstream
        r.subrequest('/' + upstream + '_backend', {
            method: 'POST',
            body: proxyBody
        }, function(reply) {
            r.return(reply.status, reply.responseText);
        });

    } catch (e) {
        r.error('Routing error: ' + e);
        r.return(500, JSON.stringify({
            error: 'Internal routing error',
            details: e.toString()
        }));
    }
}

function selectModel(prompt, userTier, requestedModel) {
    // If user requested a specific model and has access, use it
    if (requestedModel && MODELS[requestedModel]) {
        var modelConfig = MODELS[requestedModel];
        if (canAccessModel(userTier, modelConfig.tier)) {
            return { model: requestedModel, upstream: modelConfig.upstream };
        }
    }

    // Intelligent routing based on prompt length and user tier
    var promptLength = prompt.length;

    if (userTier === 'premium') {
        // Premium users get best models
        if (promptLength > 10000) {
            return { model: 'claude-3-sonnet', upstream: 'anthropic' };
        } else if (promptLength > 2000) {
            return { model: 'gpt-4', upstream: 'openai' };
        } else {
            return { model: 'gpt-4', upstream: 'openai' };
        }
    } else if (userTier === 'standard') {
        // Standard users get mid-tier models
        if (promptLength > 2000) {
            return { model: 'claude-3-sonnet', upstream: 'anthropic' };
        } else {
            return { model: 'gpt-3.5-turbo', upstream: 'openai' };
        }
    } else {
        // Free tier users get local Llama2
        return { model: 'llama2', upstream: 'ollama' };
    }
}

function canAccessModel(userTier, modelTier) {
    var tierHierarchy = { 'free': 0, 'standard': 1, 'premium': 2 };
    return tierHierarchy[userTier] >= tierHierarchy[modelTier];
}

function getUserTier(r) {
    // Check user tier from keyval zone or header
    var tier = r.variables.user_tier;
    if (tier) {
        return tier;
    }

    // Default tier based on API key prefix
    var authHeader = r.headersIn['Authorization'] || '';
    if (authHeader.indexOf('sk-premium-') !== -1) {
        return 'premium';
    } else if (authHeader.indexOf('sk-standard-') !== -1) {
        return 'standard';
    }
    return 'free';
}

function extractPrompt(request) {
    if (request.prompt) {
        return request.prompt;
    }
    if (request.messages && request.messages.length > 0) {
        // Concatenate all message contents for length calculation
        var fullPrompt = '';
        for (var i = 0; i < request.messages.length; i++) {
            fullPrompt += (request.messages[i].content || '') + ' ';
        }
        return fullPrompt.trim();
    }
    return '';
}

export default { routeRequest, selectModel, extractPrompt };
