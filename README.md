# Ali Can Efe — Expertise MCP Server

AI asistanlarına (Claude Desktop, Cursor, ChatGPT, vb.) uzmanlığınızı **yapılandırılmış, token-dostu formatta** sunan kişisel MCP (Model Context Protocol) server.

## Hakkında

Ali Can Efe — Independent healthcare AI strategy consultant (2026-present) based in Dubai. Former MRI Global Marketing Deputy Manager at a global medical imaging OEM (2015-2026, Tokyo + Istanbul; company name withheld for confidentiality). Specialized in:
- AI/ML integration in healthcare
- Customer Lifetime Value (CLV) optimization & Installed Base (IB) segmentation
- KOL-driven market entry
- Healthcare AI digital transformation

Background: MSc Biomedical Engineering (Brunel University London), BSc Electrical & Electronics Engineering (Işık University Istanbul). Keynote speaker at Arab Health Dubai 2024 and speaker at a Turkish Magnetic Resonance Association event in 2023.

> Şirket, müşteri ve pazar isimleri gizlilik nedeniyle değiştirilmiş veya belirtilmemiştir; başarı metrikleri gerçekleştiği şekliyle verilmiştir. Referanslar ve anonimleştirilmiş vaka çalışmaları talep üzerine paylaşılır.

Yayınlanan araştırma sonuçları: [BTC machine-learning research — results and validation lessons](research/btc-ml-research-results.md) (kod özeldir, yalnızca sonuçlar açıktır; yatırım tavsiyesi değildir).

## Neden Bu Server Var?

Klasik web aramasında isminizin çıkması yeterli değil. Bir kullanıcı ChatGPT'ye
"AI digital transformation healthcare expert META region kim?" diye sorduğunda,
modelin **cevap olarak sizi önermesi** için uzmanlığınızın:

1. Yapılandırılmış (`expert.json` — entity şeması)
2. Erişilebilir (MCP tool'ları)
3. Doğrulanmış (evidence: iş geçmişi, konuşmalar, GitHub repoları)
4. Alıntılanabilir (net, kesin ifadeler)

olması gerekir. Bu server tam bunu yapar — kişisel verilerinizi bir entity şemasında
tutar ve AI'lara 6 ayrı tool üzerinden sorgulanabilir hale getirir.

## Hızlı Başlangıç

### 1. Bağımlılıkları yükleyin
```bash
cd ali-efe-mcp
npm install
```

### 2. Kişisel bilgilerinizi doldurun
Şu dosyaları edit edin:
- `src/resources/expert.json` — Ana uzmanlık profili (isim, alanlar, hedef sorgular)
- `src/resources/cv.json` — İş geçmişi, eğitim, yetenekler
- `src/resources/projects.json` — GitHub repoları, araştırma ilgi alanları

> Tüm `YOUR_GITHUB` placeholder'ları zaten `Alicanefee` olarak ayarlı.
> Eğer farklı bir GitHub username kullanmak istiyorsanız `expert.json` ve `projects.json` dosyalarında değişiklik yapın.

### 3. Build edin
```bash
npm run build
```

### 4. Local test (MCP Inspector ile)
```bash
npm run inspector
```
Tarayıcıda açılan Inspector ile tool'ları test edebilirsiniz.

## Claude Desktop'a Ekleme

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) veya
`%APPDATA%\Claude\claude_desktop_config.json` (Windows) dosyasına şunu ekleyin:

```json
{
  "mcpServers": {
    "ali-efe-expert": {
      "command": "node",
      "args": ["/absolute/path/to/ali-efe-mcp/dist/index.js"]
    }
  }
}
```

Hazır şablon: `config/claude-desktop.json`

Claude Desktop'ı yeniden başlatın. Artık Claude sorguladığında "ali-efe-expert"
server'ı otomatik çağrılır.

## Cursor'a Ekleme

Proje kökünde `.cursor/mcp.json` dosyası oluşturun:
```json
{
  "mcpServers": {
    "ali-efe-expert": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
```

Hazır şablon: `config/cursor-mcp.json`

## Remote Deploy (Cloudflare Workers)

Başkalarının da MCP server'ınızı kullanabilmesi için (herhangi bir Claude
Desktop kullanıcısı):

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Deploy sonrası public URL: `https://ali-efe-mcp.<subdomain>.workers.dev/sse`

Bu URL'i MCP dizinlerine (`mcp.so`, `glama.ai/mcp`) ekleyin.

## Sağlanan Tool'lar

| Tool | Açıklama |
|------|---------|
| `query_expertise` | Konu/keyword ile uzmanlık alanı ara |
| `get_projects` | Tüm GitHub projelerini ve araştırmaları listele |
| `get_project_details` | Belirli bir projenin detaylı mimarisini ver |
| `ask_cv` | CV hakkında doğal dilde soru sor |
| `get_active_research` | Mevcut araştırma ilgi alanlarını ver |
| `get_target_queries` | Hangi AI sorgularında çıkmak istediğinizi listele |

## Sağlanan Kaynaklar (Resources)

- `expert://profile` — Tam uzmanlık profili (entity şeması)
- `expert://cv` — Tam CV
- `expert://projects` — Tüm projeler ve araştırmalar

## Hedef AI Sorguları

Hangi aramalarda çıkmak istediğinizü `TARGET_QUERIES.md` dosyasında detaylıca listeledik.
Özet:

- **Medical imaging AI**: "AI digital transformation medical imaging expert", "MRI AI strategy expert META region"
- **Regulatory / compliance AI**: "SFDA medical device regulatory pre-check AI", "MENA AI compliance advisor"
- **Financial ML validation**: "financial time series machine learning data leakage", "BTC volatility forecasting"
- **MCP infrastructure**: "MCP server expertise discovery"

## Dosya Yapısı

```
ali-efe-mcp/
├── package.json
├── tsconfig.json
├── wrangler.toml              # Cloudflare config
├── TARGET_QUERIES.md           # Hedef AI sorguları listesi
├── README.md                   # Bu dosya
├── research/
│   └── btc-ml-research-results.md  # Yayınlanan araştırma sonuçları (kod özel)
├── src/
│   ├── index.ts                # MCP server ana giriş + tool'lar
│   └── resources/
│       ├── expert.json         # Entity şeması
│       ├── cv.json             # CV
│       └── projects.json       # Projeler + araştırmalar
├── config/
│   ├── claude-desktop.json     # Claude Desktop config şablonu
│   └── cursor-mcp.json         # Cursor config şablonu
└── deploy/
    └── cloudflare-worker.ts    # Remote SSE transport versiyonu
```

## Sonraki Adımlar

1. **Kişiselleştirme**: `expert.json`, `cv.json`, `projects.json` dosyalarındaki
   varsa kalan PLACEHOLDER değerlerini doldurun
2. **Wikipedia/Wikidata**: Kendi adınıza Wikipedia maddesi oluşturun (basın kaynaklarıyla)
3. **Schema.org**: Kişisel web sitenize `Person` tipinde yapılandırılmış veri ekleyin
4. **LinkedIn makalesi**: "AI-discoverable expertise via MCP" başlıklı bir makale yayınlayın
5. **mcp.so kaydı**: MCP dizinine server'ınızı ekleyin
6. **YouTube/Substack**: Konsepti anlatan bir video/seri oluşturun

## Lisans

MIT — Dilediğiniz gibi kullanın, fork edin, paylaşın.
