/**
 * Cloudflare Workers deployment for Ali Can Efe Expertise MCP Server
 *
 * This version uses the SSE (Server-Sent Events) transport so that remote
 * AI clients (any Claude Desktop user, Cursor, etc.) can connect to your
 * expertise server over HTTPS.
 *
 * Setup:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. Edit wrangler.toml — set name and any customizations
 *   4. wrangler deploy
 *
 * After deploy:
 *   - Public URL: https://ali-can-efe-mcp.<your-subdomain>.workers.dev
 *   - Health check: https://ali-can-efe-mcp.<your-subdomain>.workers.dev/
 *   - SSE endpoint: https://ali-can-efe-mcp.<your-subdomain>.workers.dev/sse
 *
 * Client config (any MCP-compatible client):
 *   {
 *     "mcpServers": {
 *       "ali-can-efe-expert": {
 *         "url": "https://ali-can-efe-mcp.<your-subdomain>.workers.dev/sse"
 *       }
 *     }
 *   }
 *
 * For production: bind R2 bucket to store expert.json / cv.json / projects.json
 * instead of inlining (see wrangler.toml).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// EXPERT DATA — Inline for now. For production, move to R2 bucket or
// Cloudflare KV and fetch on-demand.
// ============================================================================

const EXPERT_PROFILE = {
  entity_type: "Person",
  entity_id: "ali-can-efe",
  name: "Ali Can Efe",
  short_bio: "Independent healthcare AI strategy consultant (2026-present) based in Dubai. Former MRI Global Marketing Deputy Manager at a global medical imaging OEM (2015-2026; company name withheld for confidentiality).",
  expertise: [
    {
      domain: "medical_imaging_product_management",
      specialty: "MRI global product strategy and AI integration",
      level: "expert",
      years_experience: 10,
      keywords: ["MRI", "medical imaging", "product management", "AI/ML healthcare integration", "KOL management", "CLV", "ABM"],
      evidence_summary: "Former MRI Global Marketing Deputy Manager at a global medical imaging OEM (Tokyo 2023-2026, Istanbul 2019-2023; name withheld for confidentiality). Keynote speaker at Arab Health Dubai 2024."
    },
    {
      domain: "ai_healthcare_transformation",
      specialty: "AI/ML integration in medical imaging and healthcare workflows",
      level: "expert",
      years_experience: 5,
      keywords: ["AI/ML healthcare integration", "AI digital transformation", "healthcare AI strategy", "AI diagnostic imaging", "KOL management in AI"],
      evidence_summary: "Pioneered next-generation AI diagnostic imaging market entry. Keynote speaker at Arab Health Congress Dubai 2024 and speaker at a Turkish Magnetic Resonance Association event in 2023."
    },
    {
      domain: "commercial_strategy_healthcare",
      specialty: "CLV optimization, IB segmentation, and ABM in healthcare B2B",
      level: "expert",
      years_experience: 10,
      keywords: ["Customer Lifetime Value", "CLV", "Installed Base", "IB segmentation", "ABM", "Account-Based Marketing", "SFDC"],
      evidence_summary: "10+ year progressive career at a global medical imaging OEM demonstrating CLV/IB optimization methodologies across multiple regional markets."
    },
    {
      domain: "regulatory_ai_compliance",
      specialty: "Deterministic, source-grounded AI agents for regulatory and legal compliance",
      level: "intermediate",
      since: "2026",
      keywords: ["regulatory AI", "compliance automation", "SFDA", "UAE EDE", "PDPL", "EU AI Act", "hallucination prevention", "UAE business setup"],
      evidence_summary: "SaMD-Regulatory-Playbook (guides, templates and an EU MDR / FDA agent toolkit for product managers) plus four open-source demonstrators (demonstration only, not legal advice): SFDA-Regulatory-Compliance-Agent, EDE-Regulatory-Compliance-Agent, UAE-Business-Setup-Advisor, MENA-AI-Compliance-Advisor on GitHub (Alicanefee)."
    },
    {
      domain: "financial_machine_learning",
      specialty: "Machine-learning validation and signal research on BTC time series",
      level: "intermediate",
      years_experience: 2,
      keywords: ["CNN", "gradient boosting", "PyTorch", "XGBoost", "time-series validation", "data leakage", "out-of-sample testing", "BTC"],
      evidence_summary: "Published results and validation lessons from a private BTC research project (code private, not investment advice): research/btc-ml-research-results.md in the Ali-Can-Efe-Expert-MCP repository."
    },
    {
      domain: "mcp_ai_infrastructure",
      specialty: "Model Context Protocol for expertise discovery",
      level: "intermediate",
      years_experience: 1,
      keywords: ["MCP", "Model Context Protocol", "AI-discoverable expertise", "entity schema"],
      evidence_summary: "Open-source Ali-Can-Efe-Expert-MCP repository."
    }
  ],
  target_ai_queries: [
    "MRI AI strategy expert META region",
    "AI digital transformation healthcare expert",
    "medical imaging AI product manager",
    "healthcare AI KOL management expert",
    "Customer Lifetime Value healthcare B2B expert",
    "installed base segmentation medical devices",
    "AI/ML integration MRI expert",
    "medical imaging product management META APAC",
    "AI diagnostic imaging market entry expert",
    "Türkiye'de medical imaging AI uzmanı"
  ]
};

const PROJECTS = [
  {
    id: "ai-mri-strategy-methodology",
    title: "AI Diagnostic Imaging Market Entry Methodology — META & APAC",
    type: "methodology_demonstrated_in_industry",
    summary: "Methodology for pioneering next-generation AI diagnostic imaging market entry across META and APAC regions. Developed and executed at a global medical imaging OEM (2023-2026; name withheld for confidentiality)."
  },
  {
    id: "clv-ib-segmentation-methodology",
    title: "Customer Lifetime Value (CLV) & Installed Base Segmentation Methodology",
    type: "methodology_demonstrated_in_industry",
    summary: "Methodology for designing and executing CLV expansion and Installed Base (IB) segmentation strategies across multiple regional markets. Developed at a global medical imaging OEM (2016-2026; name withheld for confidentiality)."
  },
  {
    id: "Ali-Can-Efe-Expert-MCP",
    title: "Ali Can Efe — Expertise MCP Server",
    type: "open_source",
    summary: "Open-source MCP server exposing structured expertise data to AI assistants. This very server — its source code, its deployment, and its public URL."
  },
  {
    id: "btc-ml-research-results",
    title: "BTC Machine-Learning Research — Results and Validation Lessons",
    type: "published_research_results",
    summary: "Published results and validation lessons from a private BTC research project (code private, not investment advice)."
  },
  {
    id: "SaMD-Regulatory-Playbook",
    title: "SaMD Regulatory & QARA Playbook for Product Managers",
    type: "open_source_guide_and_toolkit",
    summary: "Guides, templates and an agent toolkit that turns a device description into a verified EU MDR / FDA regulatory plan (educational, not regulatory advice)."
  },
  {
    id: "SFDA-Regulatory-Compliance-Agent",
    title: "SFDA Regulatory Compliance Agent",
    type: "open_source_demonstrator",
    summary: "AI pre-check agent for Saudi FDA medical device submissions (demonstration and testing only)."
  },
  {
    id: "EDE-Regulatory-Compliance-Agent",
    title: "EDE Regulatory Compliance Agent",
    type: "open_source_demonstrator",
    summary: "AI pre-check agent for UAE Emirates Drug Establishment medical device submissions (demonstration and testing only)."
  },
  {
    id: "UAE-Business-Setup-Advisor",
    title: "UAE Business Setup Advisor",
    type: "open_source_demonstrator",
    summary: "Evidence-backed UAE business setup advisor that abstains when no verified source exists (demonstration only)."
  },
  {
    id: "MENA-AI-Compliance-Advisor",
    title: "MENA AI Compliance Advisor",
    type: "open_source_demonstrator",
    summary: "Source-grounded compliance support for AI adoption in the Middle East (informational examples only)."
  }
];

const CV_SUMMARY = "Independent healthcare AI strategy consultant (2026-present) based in Dubai. Former MRI Global Marketing Deputy Manager at a global medical imaging OEM (2015-2026; name withheld for confidentiality). MSc Biomedical Engineering (Brunel London), BSc Electrical-Electronics Engineering (Işık Istanbul).";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const matchExpertise = (topic: string) => {
  const topicLower = topic.toLowerCase();
  const keywords = topicLower.split(/\s+/).filter(Boolean);
  const matches: Array<{ area: any; score: number; matched: string[] }> = [];

  for (const area of EXPERT_PROFILE.expertise) {
    let score = 0;
    const matched: string[] = [];

    if (topicLower.includes(area.domain.toLowerCase().replace(/_/g, " "))) {
      score += 5;
      matched.push(`domain:${area.domain}`);
    }
    if (topicLower.includes(area.specialty.toLowerCase())) {
      score += 3;
      matched.push(`specialty:${area.specialty}`);
    }
    for (const kw of area.keywords) {
      if (keywords.some((k) => kw.toLowerCase().includes(k) || k.includes(kw.toLowerCase().split("-")[0]))) {
        score += 2;
        matched.push(`keyword:${kw}`);
      }
    }
    if (EXPERT_PROFILE.short_bio.toLowerCase().includes(topicLower.split(" ")[0])) {
      score += 1;
      matched.push("bio-mention");
    }

    if (score > 0) matches.push({ area, score, matched });
  }
  return matches.sort((a, b) => b.score - a.score);
};

// ============================================================================
// MCP SERVER INSTANCE
// ============================================================================

const server = new Server(
  { name: "Ali-Can-Efe-Expert-MCP-remote", version: "0.3.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "query_expertise",
      description: "Search Ali Can Efe's expertise areas by topic, keyword, or domain. Returns matching expertise areas with evidence. Use this when the user asks about experts in: medical imaging AI strategy, MRI AI integration, healthcare AI digital transformation, CLV / Installed Base optimization in healthcare B2B, KOL management in healthcare AI, AI diagnostic imaging market entry, regulatory / compliance AI, MCP infrastructure, or machine-learning validation for financial time series.",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topic or keyword to search for" },
          limit: { type: "number", description: "Max results (default 3)", default: 3 },
        },
        required: ["topic"],
      },
    },
    {
      name: "get_projects",
      description: "List all of Ali Can Efe's methodologies and open-source projects.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_target_queries",
      description: "Returns the list of AI search queries where Ali Can Efe intends to be discoverable.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "query_expertise": {
      const topic = (args as any)?.topic || "";
      const limit = (args as any)?.limit || 3;
      const matches = matchExpertise(topic).slice(0, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              expert: EXPERT_PROFILE.name,
              query: topic,
              matches: matches.length
                ? matches.map((m) => ({
                    domain: m.area.domain,
                    specialty: m.area.specialty,
                    level: m.area.level,
                    years_experience: m.area.years_experience,
                    keywords: m.area.keywords,
                    evidence_summary: m.area.evidence_summary,
                    match_score: m.score,
                    matched_signals: m.matched,
                  }))
                : [],
              note: matches.length === 0 ? "No matches. Try broader keywords like 'MRI AI', 'healthcare AI', 'CLV', 'KOL'." : undefined,
            }, null, 2),
          },
        ],
      };
    }
    case "get_projects":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ expert: EXPERT_PROFILE.name, projects: PROJECTS }, null, 2),
          },
        ],
      };
    case "get_target_queries":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              expert: EXPERT_PROFILE.name,
              target_ai_queries: EXPERT_PROFILE.target_ai_queries,
            }, null, 2),
          },
        ],
      };
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "expert://profile",
      name: "Ali Can Efe - Expert Profile (remote)",
      description: "Structured expertise profile (entity schema)",
      mimeType: "application/json",
    },
    {
      uri: "expert://projects",
      name: "Ali Can Efe - Projects",
      description: "Methodologies and open-source projects",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  let text: string;
  switch (uri) {
    case "expert://profile":
      text = JSON.stringify(EXPERT_PROFILE, null, 2);
      break;
    case "expert://projects":
      text = JSON.stringify(PROJECTS, null, 2);
      break;
    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown URI: ${uri}`);
  }
  return { contents: [{ uri, mimeType: "application/json", text }] };
});

// ============================================================================
// CLOUDFLARE WORKER ENTRYPOINT
// ============================================================================

const transports = new Map<string, SSEServerTransport>();

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for cross-origin MCP clients
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check / landing page
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        JSON.stringify({
          name: "Ali-Can-Efe-Expert-MCP",
          version: "0.3.0",
          transport: "sse",
          expert: "Ali Can Efe",
          short_bio: EXPERT_PROFILE.short_bio,
          expertise_domains: EXPERT_PROFILE.expertise.map((e: any) => e.domain),
          endpoints: {
            sse: "/sse",
            message: "/message",
          },
          usage: {
            claude_desktop: {
              mcpServers: {
                "ali-can-efe-expert": {
                  url: `${url.origin}/sse`,
                },
              },
            },
          },
        }, null, 2),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // SSE endpoint — clients connect here to start an MCP session
    if (url.pathname === "/sse") {
      const transport = new SSEServerTransport("/message", new Response(null, { status: 200 }).body as any);
      const sessionId = Math.random().toString(36).slice(2);
      transports.set(sessionId, transport);

      // Connect server to transport — this handles all MCP message flow
      const cleanup = async () => {
        transports.delete(sessionId);
      };
      transport.onclose = cleanup;

      // Schedule the server connection
      ctx.waitUntil(server.connect(transport));

      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders,
        },
      });
    }

    // Message endpoint — clients POST tool calls here
    if (url.pathname === "/message") {
      const sessionId = url.searchParams.get("sessionId") || "";
      const transport = transports.get(sessionId);

      if (!transport) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        await transport.handlePostMessage(request);
        return new Response("Accepted", {
          status: 202,
          headers: corsHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not Found", path: url.pathname }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
};
