# NJS Modules

JavaScript modules for Nginx Plus AI routing.

## Modules

- `ai-gateway.js` - AI request routing logic
- `auth.js` - Authentication
- `cost-tracker.js` - Token and cost tracking

## Development on macOS

Edit in VS Code, test in Docker container.

```bash
# Watch for changes (requires entr)
brew install entr
ls src/*.js | entr docker-compose restart nginx-plus
```
