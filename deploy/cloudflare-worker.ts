/**
 * Cloudflare Workers entry point: remote MCP server over Streamable HTTP.
 *
 * Uses the same server core as the local stdio build (src/server.ts) and bundles
 * the JSON resources at deploy time, so the local and remote servers cannot drift.
 * The server is stateless: every request gets a fresh server + transport, so there
 * is no session state to store and nothing to clean up.
 *
 * Deploy:
 *   1. npm install
 *   2. npx wrangler login
 *   3. npm run deploy:cloudflare
 *
 * Endpoints (workers.dev subdomain is printed by the deploy):
 *   GET  /      info page (JSON) with client configuration snippets
 *   POST /mcp   MCP endpoint (Streamable HTTP, JSON responses)
 *
 * Client configuration:
 *   Cursor and other clients with native remote support:
 *     { "mcpServers": { "ali-can-efe-expert": { "url": "https://<worker>.workers.dev/mcp" } } }
 *   Claude Desktop (via the mcp-remote proxy), or add the URL as a custom connector:
 *     { "mcpServers": { "ali-can-efe-expert": { "command": "npx", "args": ["-y", "mcp-remote", "https://<worker>.workers.dev/mcp"] } } }
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createExpertServer } from "../src/server";
import expertProfile from "../src/resources/expert.json";
import cvData from "../src/resources/cv.json";
import projectsData from "../src/resources/projects.json";
import journalData from "../src/resources/journal.json";

const data = { expertProfile, cvData, projectsData, journalData };

// MCP messages are small; refuse anything larger to limit abuse of a public endpoint
const MAX_BODY_BYTES = 64 * 1024;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

const withCors = (res: Response): Response => {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Info page
    if (url.pathname === "/") {
      const endpoint = `${url.origin}/mcp`;
      return json({
        name: "Ali-Can-Efe-Expert-MCP",
        version: expertProfile.version,
        transport: "streamable-http",
        mcp_endpoint: endpoint,
        expert: expertProfile.name,
        short_bio: expertProfile.short_bio,
        expertise_domains: expertProfile.expertise.map((area) => area.domain),
        usage: {
          cursor: { mcpServers: { "ali-can-efe-expert": { url: endpoint } } },
          claude_desktop: {
            mcpServers: { "ali-can-efe-expert": { command: "npx", args: ["-y", "mcp-remote", endpoint] } },
          },
          inspector: "npx @modelcontextprotocol/inspector",
        },
        note: expertProfile.confidentiality_note,
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
        return json({ jsonrpc: "2.0", error: { code: -32600, message: "Request too large" }, id: null }, 413);
      }

      const server = createExpertServer(data);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true, // plain JSON replies instead of long-lived event streams
      });
      await server.connect(transport);
      return withCors(await transport.handleRequest(request));
    }

    return json({ error: "Not Found", path: url.pathname, hint: "The MCP endpoint is /mcp (Streamable HTTP)." }, 404);
  },
};
