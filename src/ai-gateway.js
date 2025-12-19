// AI Gateway NJS Module
function routeRequest(r) {
    try {
        var body = JSON.parse(r.requestText);
        var prompt = extractPrompt(body);
        
        r.log('Prompt length: ' + prompt.length);
        
        // Select model based on prompt length
        var model;
        var upstream;
        
        if (prompt.length > 2000) {
            model = 'claude-3-sonnet';
            upstream = 'anthropic';
        } else if (prompt.length > 500) {
            model = 'gpt-4';
            upstream = 'openai';
        } else {
            model = 'gpt-3.5-turbo';
            upstream = 'openai';
        }
        
        r.variables.target_model = model;
        r.variables.target_upstream = upstream;
        
        r.log('Routing to: ' + model + ' (' + upstream + ')');
        
        // In real implementation, this would proxy to the upstream
        r.return(200, JSON.stringify({
            routed_to: model,
            upstream: upstream,
            prompt_length: prompt.length
        }));
        
    } catch (e) {
        r.error('Routing error: ' + e);
        r.return(500, JSON.stringify({
            error: 'Internal routing error',
            details: e.toString()
        }));
    }
}

function extractPrompt(request) {
    if (request.prompt) {
        return request.prompt;
    }
    if (request.messages && request.messages.length > 0) {
        var lastMessage = request.messages[request.messages.length - 1];
        return lastMessage.content || '';
    }
    return '';
}

export default { routeRequest };
