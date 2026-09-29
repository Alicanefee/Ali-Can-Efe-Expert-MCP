#!/usr/bin/env bash
# Init script — clones the local project to a fresh git repo and prepares
# it for pushing to GitHub.
#
# Usage:
#   cd /home/z/my-project/download/ali-efe-mcp
#   bash init-github-repo.sh
#
# After this script runs, you can:
#   cd Ali-Can-Efe-Expert-MCP
#   git remote add origin git@github.com:Alicanefee/Ali-Can-Efe-Expert-MCP.git
#   git push -u origin main

set -e

PROJECT_DIR="/home/z/my-project/download/ali-efe-mcp"
REPO_NAME="Ali-Can-Efe-Expert-MCP"

echo "=== Initializing git repo ==="
cd "$PROJECT_DIR"
if [ ! -d .git ]; then
  git init -b main
fi

echo "=== Adding all files ==="
git add .

echo "=== Verifying .gitignore is in place ==="
if [ ! -f .gitignore ]; then
  echo "ERROR: .gitignore missing"
  exit 1
fi

echo "=== Files staged for commit ==="
git status --short

echo ""
echo "=== Creating initial commit ==="
git commit -m "Initial commit: Ali Can Efe expertise MCP server v0.3.0

- TypeScript MCP server with 6 tools (query_expertise, get_projects,
  get_project_details, ask_cv, get_active_research, get_target_queries)
- 3 resources (expert://profile, expert://cv, expert://projects)
- Local stdio transport + remote Cloudflare Workers SSE transport
- Real profile for Ali Can Efe (independent healthcare AI consultant,
  former MRI Global Marketing Deputy Manager at a global medical imaging OEM)
- Privacy: company, client and market names withheld; personal contact omitted
- CI workflows (build + test, Cloudflare deploy)
- Documentation: README, TARGET_QUERIES, CONTRIBUTING"

echo ""
echo "=== Git repo ready ==="
echo ""
echo "Next steps:"
echo "  1. Create a new empty repo on GitHub at:"
echo "     https://github.com/new"
echo "     Name: $REPO_NAME"
echo "     Description: 'AI-discoverable expertise MCP server for healthcare AI consultant'"
echo "     Visibility: Public"
echo "     Do NOT initialize with README/license/gitignore"
echo ""
echo "  2. Add remote and push:"
echo "     cd $PROJECT_DIR"
echo "     git remote add origin git@github.com:Alicanefee/$REPO_NAME.git"
echo "     git push -u origin main"
echo ""
echo "  3. After push, edit src/resources/*.json to replace Alicanefee"
echo "     with your actual GitHub username, then commit + push:"
echo "     git add . && git commit -m 'Update GitHub username in resource files' && git push"
