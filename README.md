# Ali Can Efe: Professional Profile MCP Server

An open-source [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that publishes one professional profile as structured data: background, consulting services, projects and published research results. An AI assistant connected to it can answer questions such as "What has Ali worked on in medical AI?" from a single, citable source instead of piecing the answer together from scattered web pages.

## Read this first: it is a self-published profile

- Everything in this repository is written by the author. It shows what is claimed, not an independent assessment.
- The `get_evidence` tool and the table below separate what anyone can check from what is available on request.
- Client names and market names are withheld or changed for confidentiality. The employer is named. Achievement metrics are reported as delivered.
- Levels such as "expert" are the author's own labels. The depth is greatest in MRI / medical imaging product management and healthcare commercial strategy. Regulatory AI and financial machine learning are newer areas and are marked as such.

## About

Ali Can Efe is an independent healthcare AI strategy consultant based in Dubai (since 2026). Before that he spent more than ten years at Canon Medical Systems (2015-2026), in MRI product management and global marketing across META (Middle East, Turkey, Africa) and APAC. MSc in Biomedical Engineering (Brunel University London) and BSc in Electrical & Electronics Engineering (Işık University, Istanbul).

Areas covered: AI/ML integration in medical imaging, installed-base and customer-lifetime-value strategy for medical device manufacturers, regulatory AI (SaMD, EU MDR, FDA, SFDA, UAE EDE), and validation practice in financial machine learning.

## Evidence and sources

| Claim | How to check |
|---|---|
| Career history (Canon Medical Systems, 2015-2026) and contact | [LinkedIn profile](https://www.linkedin.com/in/ali-can-efe). It is written by the author. Professional references are available on request. |
| Speaker at Canon satellite symposia at the Turkish Magnetic Resonance Association (TMRD) annual meetings | Official programmes on the association's website: [2022, page 10](https://tmrd.org.tr/uploads/tbl_bildiriler/62a05a9c99ced_tbl_bildiriler2022111524.pdf) ("Akıllı MR ile Üst Düzey Verimlilik: Derin Öğrenme Rekonstrüksiyon & İş Akışlarında Otomasyon") and [2023, page 8](https://tmrd.org.tr/uploads/tbl_bildiriler/646c70f541b43_tbl_bildiriler2023105325.pdf) ("PIQE ile MRI Görüntülerinin Tam Potansiyelini Keşfedin", with Katsuhiro Ito). Both were sponsor symposia, not scientific abstract sessions. The files are large (48 MB and 45 MB). |
| Keynote speaker at Arab Health, Dubai, 2024 | Programme and session details on request |
| BSc, first in the department with a high honor degree (Işık University, 2011) | [2010-2011 graduation ceremony recording](https://www.youtube.com/watch?v=bD-lcxIjZfk&t=4800s), announcement from about 1:20:00. The recording has no captions. Official documents available on request |
| MSc, Brunel University London (2013) | Degree certificate on request |
| Source code and documentation | The repositories below, open for inspection |
| Research results | [BTC machine-learning research: results and validation lessons](research/btc-ml-research-results.md). Code and data are private, so the runs cannot be reproduced. |

### Projects

| Repository | What it is |
|---|---|
| [Ali-Can-Efe-Expert-MCP](https://github.com/Alicanefee/Ali-Can-Efe-Expert-MCP) | This server |
| [SaMD-Regulatory-Playbook](https://github.com/Alicanefee/SaMD-Regulatory-Playbook) | Guides, templates and an agent toolkit for SaMD regulatory planning (EU MDR, FDA). Educational material, not regulatory advice |
| [SFDA-Regulatory-Compliance-Agent](https://github.com/Alicanefee/SFDA-Regulatory-Compliance-Agent) | Saudi FDA medical device submission pre-check agent. Demonstration with synthetic data |
| [EDE-Regulatory-Compliance-Agent](https://github.com/Alicanefee/EDE-Regulatory-Compliance-Agent) | UAE Emirates Drug Establishment pre-check agent. Demonstration with synthetic data |
| [UAE-Business-Setup-Advisor](https://github.com/Alicanefee/UAE-Business-Setup-Advisor) | Evidence-backed UAE business setup advisor that abstains without a verified source. Demonstration with sample data |
| [MENA-AI-Compliance-Advisor](https://github.com/Alicanefee/MENA-AI-Compliance-Advisor) | Source-grounded compliance support for AI adoption in the Middle East. Informational examples only |

The regulatory repositories are demonstrations and are not legal or regulatory advice. The research document is not investment advice.

## Connect

Remote endpoint (Streamable HTTP): `https://ali-can-efe-mcp.alicanefe61.workers.dev/mcp`

Cursor and other clients with native remote support:

```json
{ "mcpServers": { "ali-can-efe-expert": { "url": "https://ali-can-efe-mcp.alicanefe61.workers.dev/mcp" } } }
```

Claude Desktop, through the `mcp-remote` proxy (or add the URL as a custom connector):

```json
{
  "mcpServers": {
    "ali-can-efe-expert": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ali-can-efe-mcp.alicanefe61.workers.dev/mcp"]
    }
  }
}
```

To run it locally over stdio instead, see [Run locally](#run-locally) and the templates in `config/`.

## Tools and resources

| Tool | Purpose |
|---|---|
| `query_expertise` | Search expertise areas and consulting services by topic, with supporting evidence |
| `get_projects` | List projects, repositories and research interests |
| `get_project_details` | Details of one project or consulting service by ID |
| `ask_cv` | Answer a natural-language question about roles, skills, education or talks |
| `get_active_research` | Current research interests |
| `get_evidence` | Which claims can be checked, with links, and which are available on request |

Resources: `expert://profile`, `expert://cv`, `expert://projects`.

## Run locally

```bash
npm install
npm run build
node dist/index.js        # stdio server
npm run inspector         # test the tools in the MCP Inspector
```

The profile data lives in `src/resources/` (`expert.json`, `cv.json`, `projects.json`). The server core is `src/server.ts`; `src/index.ts` is the stdio entry point.

## Deploy your own on Cloudflare Workers

The worker reuses the same core and bundles the JSON files at deploy time. It is stateless and answers over Streamable HTTP.

```bash
npm install
npx wrangler login
npm run deploy:cloudflare
```

Check a deployment with `npm run smoke:remote -- https://<your-worker>.workers.dev/mcp`. For automatic deploys from GitHub Actions, add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (see `.github/workflows/deploy.yml`).

## Use it as a template

The code is MIT-licensed, so you can fork it and publish your own profile. Replace the three JSON files, keep the separation between publicly verifiable claims and claims available on request, and rename the tool descriptions.

## License

MIT
