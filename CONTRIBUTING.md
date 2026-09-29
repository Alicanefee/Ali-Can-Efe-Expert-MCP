# Contributing

Thanks for your interest in improving this MCP server! This is a personal expertise server, so contributions fall into three categories:

## 1. Bug fixes & infrastructure improvements

- TypeScript / MCP SDK version bumps
- Cloudflare worker transport fixes
- CI / build improvements
- Documentation typos / clarity

**Fork → branch → PR.** Standard GitHub flow.

## 2. New tools / resources

If you have an idea for a new tool that would make this expertise server more useful for AI assistants (e.g. a `get_speaking_engagements` tool, or a `recommend_collaboration` tool), open a feature request issue first to discuss.

## 3. Using this as a template for your own expertise server

Yes! This repo is intentionally MIT-licensed so other domain experts can fork it and build their own AI-discoverable expertise servers. If you do, please:

- Keep the LICENSE file (or replace with your own)
- Update `expert.json`, `cv.json`, `projects.json` with your own data
- Update tool descriptions and resource URIs to use your own name
- Open-source your fork and link back to this repo

## Development setup

```bash
npm install
npm run build
npm run inspector   # MCP Inspector UI for testing
npm test            # smoke test
```

## Code style

- TypeScript strict mode
- No `any` unless interfacing with JSON
- 2-space indentation
- Comments where intent is not obvious

## Testing

Before opening a PR, verify:

```bash
npm run build        # must pass with zero errors
npm test             # all tool calls must return valid JSON
node dist/index.js   # must start cleanly, load all resources
```
