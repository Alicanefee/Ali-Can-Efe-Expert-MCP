#!/usr/bin/env node
/**
 * Ali Can Efe - Expertise MCP Server (local stdio entry point)
 *
 * Exposes structured expertise data to AI tools via Model Context Protocol.
 * AI assistants (Claude Desktop, Cursor, etc.) can query this server to learn
 * about Ali Can Efe's expertise in healthcare AI strategy, regulatory AI,
 * financial ML validation and AI-driven digital transformation.
 *
 * Usage:
 *   - Local (stdio):  node dist/index.js
 *   - Remote (HTTP):  see deploy/cloudflare-worker.ts
 *
 * The tools and resources are defined in src/server.ts:
 *   Tools:     query_expertise, get_projects, get_project_details, ask_cv,
 *              get_active_research, get_target_queries
 *   Resources: expert://profile, expert://cv, expert://projects
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createExpertServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load resource files at startup
const loadJson = <T>(relativePath: string): T => {
  try {
    // When running compiled JS from dist/, resources are at ../src/resources/
    // When running via tsx from src/, resources are at ./resources/
    // Try both paths
    const candidates = [
      join(__dirname, relativePath),              // dist/ -> ../src/resources/...
      join(__dirname, "../src/resources", relativePath.replace(/^(\.\.\/)?(src\/)?resources\//, "")),
      join(__dirname, "../resources", relativePath.replace(/^(\.\.\/)?(src\/)?resources\//, "")),
    ];
    for (const p of candidates) {
      try {
        // Strip a UTF-8 BOM if present (Windows editors/PowerShell may add one)
        return JSON.parse(readFileSync(p, "utf-8").replace(/^\uFEFF/, "")) as T;
      } catch {
        // try next
      }
    }
    throw new Error(`File not found in any candidate path: ${relativePath}`);
  } catch (err) {
    console.error(`[ali-efe-mcp] Failed to load ${relativePath}:`, err);
    return {} as T;
  }
};

// Load resource files at startup
// (path resolution logic remains from v0.1.0)
const expertProfile = loadJson<any>("../resources/expert.json");
const cvData = loadJson<any>("../resources/cv.json");
const projectsData = loadJson<any>("../resources/projects.json");

const server = createExpertServer({ expertProfile, cvData, projectsData });

// ============================================================================
// START SERVER
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[ali-efe-mcp] Server started. Loaded profile for: ${expertProfile.name}`);
  console.error(`[ali-efe-mcp] Expertise areas: ${(expertProfile.expertise || []).map((e: any) => e.domain).join(", ")}`);
  console.error(`[ali-efe-mcp] Projects: ${(projectsData.projects || []).length}`);
}

main().catch((err) => {
  console.error("[ali-efe-mcp] Fatal error:", err);
  process.exit(1);
});
