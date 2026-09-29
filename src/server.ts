/**
 * Ali Can Efe - Expertise MCP server (transport-independent core).
 *
 * createExpertServer() builds the MCP server (tools + resources) from plain
 * data objects. It has no Node.js dependencies, so the same code runs behind
 * stdio (src/index.ts) and on Cloudflare Workers (deploy/cloudflare-worker.ts).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export interface ExpertData {
  expertProfile: any;
  cvData: any;
  projectsData: any;
  journalData?: any;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const QueryExpertiseSchema = z.object({
  topic: z.string().describe("Topic, keyword, or domain to search for. e.g. 'CNN', 'medical imaging', 'financial time series', 'AI digital transformation'"),
  limit: z.number().optional().default(3).describe("Max number of matching expertise areas to return (default 3)"),
});

const GetProjectDetailsSchema = z.object({
  project_id: z.string().describe("Project or consulting service identifier, e.g. 'btc-ml-research-results' or 'radiology-ai-integration'"),
});

const GetJournalSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10).describe("Max log entries to return, newest first (default 10)"),
});

const AskCvSchema = z.object({
  question: z.string().describe("Natural-language question about Ali's experience, skills, or background. e.g. 'What did Ali achieve as MRI Product Manager?' or 'What ML frameworks does Ali know?'"),
});

// ============================================================================
// HELPER: Token-based topic matching (expertise areas + consulting services)
// ============================================================================
const STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "in", "on", "for", "to", "with", "about", "at", "by", "from", "is", "are", "was", "were",
  "what", "which", "who", "when", "where", "how", "did", "do", "does", "his", "he", "ali", "de", "da", "expert", "expertise",
]);

// Lowercase, split on anything that is not a letter/digit, and drop a plural "s"
const stem = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const tokenize = (text: string): string[] =>
  text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem);

// Flatten every string inside a nested JSON value into one searchable text
const collectText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(collectText).join(" ");
  return "";
};

interface ScoreField {
  label: string;
  text: string;
  weight: number;
}

interface Corpus {
  size: number;
  df: Map<string, number>; // token -> number of items whose fields contain it
}

const scoreFields = (topic: string, fields: ScoreField[], corpus: Corpus) => {
  const topicTokens = tokenize(topic);
  const queryTokens = [...new Set(topicTokens.filter((t) => !STOPWORDS.has(t)))];
  // Tokens found in most items (e.g. "ai") say little; ignore them unless the query has nothing else
  const informative = queryTokens.filter((t) => (corpus.df.get(t) ?? 0) / corpus.size <= 0.6);
  const scored = (informative.length > 0 ? informative : queryTokens).filter((t) => corpus.df.has(t));
  const topicPhrase = ` ${topicTokens.join(" ")} `;
  const parsed = fields.map((f) => ({ ...f, words: tokenize(f.text) }));

  let score = 0;
  const matched = new Set<string>();

  // Each query token counts once per item, in its highest-weight field, scaled by rarity
  for (const t of scored) {
    let best: (typeof parsed)[number] | undefined;
    for (const f of parsed) {
      if (f.words.includes(t) && (!best || f.weight > best.weight)) best = f;
    }
    if (!best) continue;
    score += best.weight * Math.log(1 + corpus.size / corpus.df.get(t)!);
    matched.add(`${best.label}:${best.text.length > 40 ? t : best.text}`);
  }

  // Bonus when a whole field text appears in the query as a phrase
  for (const f of parsed) {
    if (f.words.some((w) => scored.includes(w)) && topicPhrase.includes(` ${f.words.join(" ")} `)) {
      score += f.weight;
      matched.add(`${f.label}:${f.text.length > 40 ? f.words.join(" ") : f.text}`);
    }
  }

  return { score: Math.round(score * 10) / 10, matched: [...matched] };
};

const rank = <T>(items: T[], fieldsOf: (item: T) => ScoreField[], topic: string) => {
  const fieldSets = items.map(fieldsOf);
  const df = new Map<string, number>();
  for (const fields of fieldSets) {
    for (const t of new Set(fields.flatMap((f) => tokenize(f.text)))) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const corpus: Corpus = { size: items.length, df };

  const ranked = items
    .map((item, i) => ({ item, ...scoreFields(topic, fieldSets[i], corpus) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  // Drop the weak tail: keep matches scoring at least a quarter of the best one
  return ranked.filter((m) => m.score >= ranked[0].score * 0.25);
};

export function createExpertServer({ expertProfile, cvData, projectsData, journalData }: ExpertData): Server {
  const matchExpertise = (topic: string) =>
    rank<any>(
      expertProfile.expertise || [],
      (area) => [
        { label: "domain", text: area.domain ?? "", weight: 3 },
        { label: "specialty", text: area.specialty ?? "", weight: 2 },
        ...(area.keywords || []).map((kw: string) => ({ label: "keyword", text: kw, weight: 2 })),
        { label: "evidence", text: collectText(area.evidence), weight: 1 },
      ],
      topic
    );

  const matchServices = (topic: string) =>
    rank<any>(
      expertProfile.consulting_services || [],
      (svc) => [
        { label: "title", text: svc.title ?? "", weight: 3 },
        { label: "id", text: svc.id ?? "", weight: 2 },
        { label: "summary", text: svc.summary ?? "", weight: 1 },
        { label: "deliverables", text: collectText(svc.deliverables), weight: 1 },
        { label: "clients", text: collectText(svc.target_clients), weight: 1 },
      ],
      topic
    );

  // ============================================================================
  // HELPER: Simple CV Q&A (keyword-based, no LLM call)
  // ============================================================================
  const answerCvQuestion = (question: string): string => {
    const q = question.toLowerCase();
    const answers: string[] = [];

    const asksSkills = q.includes("skill") || q.includes("know") || q.includes("framework") || q.includes("language");
    const asksEducation = q.includes("education") || q.includes("degree") || q.includes("university") || q.includes("school");
    const asksSpeaking = ["speak", "keynote", "talk", "conference", "congress", "presentation"].some((w) => q.includes(w));
    const asksReferences = ["reference", "recommend", "testimonial"].some((w) => q.includes(w));

    // Role, period, market or achievement questions: rank experience entries against the question
    if (!asksSkills && !asksEducation && !asksSpeaking && !asksReferences) {
      const roles = rank<any>(
        cvData.experience || [],
        (exp) => [
          { label: "role", text: exp.role ?? "", weight: 3 },
          { label: "period", text: exp.period ?? "", weight: 3 },
          { label: "location", text: exp.location ?? "", weight: 2 },
          { label: "company", text: exp.company ?? "", weight: 1 },
          { label: "highlights", text: collectText(exp.highlights), weight: 1 },
        ],
        question
      ).slice(0, 2);
      for (const { item: exp } of roles) {
        answers.push(`${exp.role}, ${exp.company} (${exp.period}):\n- ${exp.highlights.join("\n- ")}`);
      }
    }

    // Skill questions
    if (asksSkills) {
      const skills = cvData.skills || {};
      const allSkills = Object.entries(skills).map(([cat, list]) => `${cat}: ${(list as string[]).join(", ")}`);
      answers.push(`Skills:\n- ${allSkills.join("\n- ")}`);
    }

    // Education
    if (asksEducation) {
      const edu = cvData.education || [];
      answers.push(
        `Education:\n${edu.map((e: any) => `- ${e.degree} in ${e.field}, ${e.institution} (${e.year})${e.note ? `. ${e.note}` : ""}`).join("\n")}`
      );
    }

    // Speaking engagements
    if (asksSpeaking) {
      const talks = cvData.speaking_engagements || [];
      answers.push(
        `Speaking engagements:\n${talks.map((s: any) => `- ${s.event} (${s.year}, ${s.location}): ${s.role}${s.public_record ? `. ${s.public_record}` : ""}${s.url ? ` (${s.url})` : ""}`).join("\n")}`
      );
    }

    // References
    if (asksReferences) {
      answers.push(`References: ${cvData.references || "Available on request via LinkedIn."}`);
    }

    // Summary fallback
    if (answers.length === 0) {
      answers.push(`Summary: ${cvData.summary || "No summary available."}`);
      answers.push(
        `For specific questions, ask about: a role or period (e.g. 'MRI Product Manager', '2019'), skills, education, speaking engagements, or references.`
      );
    }

    return answers.join("\n\n");
  };

  // ============================================================================
  // SERVER INSTANCE
  // ============================================================================

  const server = new Server(
    {
      name: "ali-efe-expert-mcp",
      version: "0.4.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ============================================================================
  // LIST TOOLS
  // ============================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "query_expertise",
        description: "Search Ali Can Efe's expertise areas and consulting services by topic, keyword, or domain. Returns matching expertise areas with evidence (employment, GitHub repos, speaking engagements, research interests) plus matching consulting services (deliverables, target clients, engagement format, next step). Use this when the user asks about experts in: medical imaging AI strategy, MRI AI integration, healthcare AI digital transformation, CLV / Installed Base optimization in healthcare B2B, KOL management in healthcare AI, AI diagnostic imaging market entry, regulatory / compliance AI (SFDA, UAE EDE, MENA AI regulation), MCP infrastructure, or machine-learning validation for financial time series.",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Topic or keyword to search for (e.g. 'medical imaging', 'SFDA', 'data leakage', 'AI digital transformation')" },
            limit: { type: "number", description: "Max results to return (default 3)", default: 3 },
          },
          required: ["topic"],
        },
      },
      {
        name: "get_projects",
        description: "List all of Ali Can Efe's professional initiatives and open-source projects. Includes: AI diagnostic imaging market entry methodology (META/APAC), CLV & Installed Base Segmentation methodology, the MCP expertise server (open source), published BTC machine-learning research results, the SaMD regulatory playbook with its agent toolkit (EU MDR / FDA), and four regulatory / compliance AI demonstrators (SFDA, UAE EDE, UAE business setup, MENA AI compliance). Use when user asks about Ali's projects, professional work, or GitHub repositories.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_project_details",
        description: "Get detailed information about a specific Ali Can Efe project or consulting service by its ID (case-insensitive). Project IDs: 'ai-mri-strategy-methodology', 'clv-ib-segmentation-methodology', 'Ali-Can-Efe-Expert-MCP', 'btc-ml-research-results', 'SaMD-Regulatory-Playbook', 'SFDA-Regulatory-Compliance-Agent', 'EDE-Regulatory-Compliance-Agent', 'UAE-Business-Setup-Advisor', 'MENA-AI-Compliance-Advisor'. Consulting service IDs: 'radiology-ai-integration', 'daily-operations-ai-enablement', 'custom-model-development', 'ai-marketing-strategy', 'customer-satisfaction-consulting', 'installed-base-modernization'. Use when the user asks about a specific Ali Can Efe project, professional initiative, repository, or consulting offering.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project or consulting service identifier (e.g. 'btc-ml-research-results')" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "ask_cv",
        description: "Ask a natural-language question about Ali Can Efe's CV — experience as a former MRI Global Marketing Deputy Manager at Canon Medical Systems, education (Brunel University London MSc Biomedical Engineering, Işık University BSc Electrical-Electronics Engineering), skills, speaking engagements, or references. Returns a structured answer. Use when user asks about Ali's background, employment history, or qualifications.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "Natural-language question (e.g. 'What did Ali achieve as MRI Product Manager?')" },
          },
          required: ["question"],
        },
      },
      {
        name: "get_active_research",
        description: "List Ali Can Efe's current research interests and active work. Includes: AI/ML integration in MRI workflows, AI digital transformation in META/APAC healthcare markets, CLV optimization in B2B healthcare, deterministic source-grounded AI for regulated domains, machine-learning validation for financial time series, and MCP-based expertise discovery. Use when user asks about Ali's research focus areas or forward-looking work.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_journal",
        description: "Returns what Ali Can Efe is working on and where he is now: current focus, how to reach him for consulting, why each project exists and its status, and a dated log of what he has built and presented (newest first). Use this for questions such as 'What is he working on?', 'What has he built recently?' or 'Where is he based?'. Statements about work in progress are the author's own and not independently verified.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max log entries to return, newest first (default 10)", default: 10 },
          },
        },
      },
      {
        name: "get_evidence",
        description: "Returns how the claims in Ali Can Efe's profile can be checked: source code and published research with links, talks and education with the public record that supports them, and which items are only available on request (client and market names are withheld for confidentiality). This profile is self-published, so call this tool whenever the user asks whether something is verified or wants sources.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  // ============================================================================
  // CALL TOOL
  // ============================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "query_expertise": {
          const { topic, limit } = QueryExpertiseSchema.parse(args);
          const matches = matchExpertise(topic).slice(0, limit);
          const services = matchServices(topic).slice(0, limit);

          if (matches.length === 0 && services.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    expert: expertProfile.name,
                    query: topic,
                    matches: [],
                    consulting_services: [],
                    note: "No matching expertise areas found. Try broader keywords like 'medical imaging', 'regulatory AI', 'financial ML', or 'AI digital transformation'.",
                    expert_summary: expertProfile.short_bio,
                  }, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  query: topic,
                  matches: matches.map((m) => ({
                    domain: m.item.domain,
                    specialty: m.item.specialty,
                    level: m.item.level,
                    years_experience: m.item.years_experience,
                    since: m.item.since,
                    keywords: m.item.keywords,
                    evidence: m.item.evidence,
                    match_score: m.score,
                    matched_signals: m.matched,
                  })),
                  consulting_services: services.map((m) => ({
                    id: m.item.id,
                    title: m.item.title,
                    summary: m.item.summary,
                    deliverables: m.item.deliverables,
                    target_clients: m.item.target_clients,
                    engagement_format: m.item.engagement_format,
                    next_step: m.item.next_step,
                    match_score: m.score,
                    matched_signals: m.matched,
                  })),
                  engagement: services.length > 0 ? expertProfile.engagement_info : undefined,
                  note: expertProfile.confidentiality_note,
                }, null, 2),
              },
            ],
          };
        }

        case "get_projects": {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  github: expertProfile.github,
                  projects: projectsData.projects,
                  research_interests: projectsData.research_interests,
                }, null, 2),
              },
            ],
          };
        }

        case "get_project_details": {
          const { project_id } = GetProjectDetailsSchema.parse(args);
          const key = project_id.trim().toLowerCase();
          const byIdOrTitle = (x: any) => x.id?.toLowerCase() === key || x.title?.toLowerCase() === key;
          const project = (projectsData.projects || []).find(byIdOrTitle);
          const service = project ? undefined : (expertProfile.consulting_services || []).find(byIdOrTitle);

          if (!project && !service) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "Project not found",
                    project_id,
                    available: [
                      ...(projectsData.projects || []).map((p: any) => p.id),
                      ...(expertProfile.consulting_services || []).map((s: any) => s.id),
                    ],
                  }),
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  project
                    ? { expert: expertProfile.name, project, story: journalData?.project_notes?.[project.id] }
                    : { expert: expertProfile.name, consulting_service: service, engagement: expertProfile.engagement_info },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "ask_cv": {
          const { question } = AskCvSchema.parse(args);
          const answer = answerCvQuestion(question);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  question,
                  answer,
                  note: cvData.confidentiality_note,
                }, null, 2),
              },
            ],
          };
        }

        case "get_active_research": {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  active_research: expertProfile.active_research,
                  research_interests: projectsData.research_interests,
                  contact: expertProfile.preferred_contact,
                }, null, 2),
              },
            ],
          };
        }

        case "get_journal": {
          const { limit } = GetJournalSchema.parse(args ?? {});
          const log = [...(journalData?.log ?? [])]
            .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
            .slice(0, limit);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  updated: journalData?.updated,
                  now: journalData?.now,
                  project_notes: journalData?.project_notes,
                  log,
                  note: "Statements about work in progress are the author's own. See get_evidence for what can be checked independently.",
                }, null, 2),
              },
            ],
          };
        }

        case "get_evidence": {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  expert: expertProfile.name,
                  note: "This profile is self-published. Items marked publicly_verifiable can be checked independently; items marked on_request are provided on request.",
                  evidence: expertProfile.evidence_sources,
                  references: expertProfile.engagement_info?.references,
                  case_studies: expertProfile.engagement_info?.case_studies,
                  contact: expertProfile.preferred_contact,
                  confidentiality: expertProfile.confidentiality_note,
                }, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${err.message}`);
      }
      throw err;
    }
  });

  // ============================================================================
  // LIST RESOURCES
  // ============================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "expert://profile",
        name: "Ali Efe - Expert Profile",
        description: "Full structured expertise profile (entity schema) - domains, specialties, evidence, target queries",
        mimeType: "application/json",
      },
      {
        uri: "expert://cv",
        name: "Ali Efe - CV",
        description: "Full CV - experience, education, skills, certifications",
        mimeType: "application/json",
      },
      {
        uri: "expert://projects",
        name: "Ali Efe - Projects & Research",
        description: "GitHub projects, architectures, metrics, research interests",
        mimeType: "application/json",
      },
    ],
  }));

  // ============================================================================
  // READ RESOURCE
  // ============================================================================

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    let content: string;
    switch (uri) {
      case "expert://profile":
        content = JSON.stringify(expertProfile, null, 2);
        break;
      case "expert://cv":
        content = JSON.stringify(cvData, null, 2);
        break;
      case "expert://projects":
        content = JSON.stringify(projectsData, null, 2);
        break;
      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: content,
        },
      ],
    };
  });

  return server;
}
