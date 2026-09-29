#!/usr/bin/env node
/**
 * Smoke test for the remote (Streamable HTTP) MCP endpoint.
 *
 * Usage:
 *   node scripts/smoke-remote.mjs                                   # local `wrangler dev`
 *   node scripts/smoke-remote.mjs https://<worker>.workers.dev/mcp  # deployed worker
 */

const endpoint = process.argv[2] ?? "http://127.0.0.1:8787/mcp";
const origin = new URL(endpoint).origin;

let nextId = 1;
let failures = 0;

const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

// Accepts both plain JSON replies and single-event SSE replies
const parseBody = (contentType, text) => {
  if (contentType.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
    return dataLine ? JSON.parse(dataLine.slice(5).trim()) : undefined;
  }
  return text ? JSON.parse(text) : undefined;
};

const rpc = async (method, params) => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const body = parseBody(res.headers.get("content-type") ?? "", await res.text());
  return { status: res.status, body };
};

const callTool = async (name, args) => {
  const { body } = await rpc("tools/call", { name, arguments: args });
  return { isError: body?.result?.isError, data: JSON.parse(body?.result?.content?.[0]?.text ?? "{}") };
};

// 1. Info page
const info = await fetch(origin + "/");
const infoJson = await info.json().catch(() => ({}));
check("info page", info.status === 200 && infoJson.transport === "streamable-http", `version ${infoJson.version}`);

// 2. Protocol handshake and tool list
const init = await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "smoke-remote", version: "0" },
});
check("initialize", init.status === 200 && init.body?.result?.serverInfo?.name === "ali-efe-expert-mcp");

const tools = await rpc("tools/list", {});
const toolNames = (tools.body?.result?.tools ?? []).map((t) => t.name);
check("tools/list", toolNames.length === 6 && toolNames.includes("get_evidence"), toolNames.join(", "));

// 3. Tool behaviour
const q = await callTool("query_expertise", { topic: "SaMD regulatory playbook for product managers" });
check("query_expertise ranks regulatory area first", q.data.matches?.[0]?.domain === "regulatory_ai_compliance");

const svc = await callTool("query_expertise", { topic: "installed base modernization consultant" });
check("query_expertise returns consulting service with next_step", !!svc.data.consulting_services?.[0]?.next_step);

const detail = await callTool("get_project_details", { project_id: "samd-regulatory-playbook" });
check("get_project_details (case-insensitive id)", detail.data.project?.id === "SaMD-Regulatory-Playbook");

const missing = await callTool("get_project_details", { project_id: "does-not-exist" });
check("get_project_details reports unknown id as error", missing.isError === true);

const cv = await callTool("ask_cv", { question: "What did Ali achieve as MRI Product Manager?" });
check("ask_cv answers from CV", typeof cv.data.answer === "string" && cv.data.answer.includes("MRI Product Manager"));

const evidence = await callTool("get_evidence", {});
const sources = evidence.data.evidence ?? [];
check("get_evidence lists verifiable sources", sources.length >= 6 && sources.some((e) => e.verification === "on_request") && sources.some((e) => e.sources?.some((x) => x.url?.startsWith("https://github.com/"))), `${sources.length} entries`);

// 4. Confidentiality: withheld names must not leave the server.
// The terms are read from the environment so they are never written into the repository:
//   FORBIDDEN_TERMS="Name One,Name Two" node scripts/smoke-remote.mjs <url>
const forbidden = (process.env.FORBIDDEN_TERMS ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
if (forbidden.length === 0) {
  console.log("SKIP  confidentiality check  (set FORBIDDEN_TERMS to enable)");
} else {
  const everything = JSON.stringify([infoJson, q.data, svc.data, detail.data, cv.data]).toLowerCase();
  const leaked = forbidden.filter((term) => everything.includes(term));
  check("no withheld names in responses", leaked.length === 0, leaked.length ? `found: ${leaked.length} term(s)` : "");
}

// 5. Guard rails
const cors = await fetch(endpoint, { method: "OPTIONS" });
check("CORS preflight", cors.status === 204 && cors.headers.get("access-control-allow-origin") === "*");

const big = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: "x".repeat(70 * 1024),
});
check("oversized body rejected", big.status === 413, `status ${big.status}`);

const notFound = await fetch(origin + "/nope");
check("unknown path returns 404", notFound.status === 404);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
