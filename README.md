# NJS Modules for AI Gateway

JavaScript modules for Nginx Plus intelligent AI request routing.

## Modules

### ai-gateway.js

Main routing module with intelligent model selection based on:
- **Prompt length**: Longer prompts routed to models with larger context windows
- **User tier**: Premium/Standard/Free access levels
- **Requested model**: Honor user preferences when tier allows

Supported models:
- GPT-4 (OpenAI) - Premium tier
- GPT-3.5 Turbo (OpenAI) - Standard tier
- Claude 3 Sonnet (Anthropic) - Premium tier, long context
- Llama2 (Ollama) - Free tier, local inference

### auth.js

Authentication and authorization module:
- `validateApiKey(r)` - Validates Bearer token format and keyval lookup
- `checkQuota(r)` - Checks user's remaining API quota
- `extractUserId(r)` - Extracts user ID from API key or headers
- `getUserTier(r)` - Determines user's subscription tier

## API Key Format

Keys follow the format: `sk-{tier}-{userId}-{random}`

Examples:
- `sk-premium-user123-abc123def456` - Premium tier
- `sk-standard-user456-xyz789` - Standard tier
- `sk-free-user789-test123` - Free tier

## Development on macOS

### Prerequisites

```bash
# Install file watcher
brew install entr
```

### Testing Changes

```bash
# Watch for changes and restart Nginx
ls src/*.js | entr docker-compose restart nginx-plus

# Or use Docker volume mounts for live reload
docker run -v "$(pwd)/src:/etc/nginx/njs:ro" nginx-ai-gateway
```

### Debugging

Enable NJS debugging in nginx.conf:
```nginx
error_log /var/log/nginx/error.log debug;
```

View logs:
```bash
docker logs -f ai-gateway 2>&1 | grep njs
```

## Usage in Nginx Config

```nginx
js_path "/etc/nginx/njs/";
js_import ai from ai-gateway.js;
js_import auth from auth.js;

location /v1/chat/completions {
    js_content ai.routeRequest;
}
```

## Testing

```bash
# Run unit tests
cd tests && npm test

# Test routing logic
curl -X POST https://localhost/v1/chat/completions \
  -H "Authorization: Bearer sk-premium-test-123456" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
