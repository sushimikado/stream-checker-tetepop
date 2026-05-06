export default async function handler(req, res) {
  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const DATABASE_ID = process.env.NOTION_DATABASE_ID;

    function escapeHtml(str) {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    // URL表示用（https削除）
function formatUrl(url) {
  if (!url) return "";

  try {
    const u = new URL(url);
    return u.hostname; // ← ドメインだけ取得
  } catch {
    return url;
  }
}
    
// 配信プラットフォームアイコン
function getPlatformIcon(url) {
  if (!url) return "";

  // YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return `
<svg class="icon-svg youtube" viewBox="0 0 2400 1681.2">
  <path fill="currentColor" d="M2349.17,262.97c-28.06-103.43-106.94-184.08-212.13-212.13C1951.21,0,1199.13,0,1199.13,0c0,0-750.33,0-936.16,50.84-103.44,28.05-184.08,108.7-213.88,212.13C0,448.8,0,839.74,0,839.74c0,0,0,390.94,49.09,578.53,29.8,101.68,110.45,184.07,213.88,212.12,185.83,50.84,936.16,50.84,936.16,50.84,0,0,752.08,0,937.91-50.84,105.18-28.05,184.07-110.45,212.13-212.12,50.83-187.59,50.83-578.53,50.83-578.53,0,0,0-390.94-50.83-576.77ZM960.7,1200.88V480.36l622.36,359.39-622.36,361.14h0Z"/>
</svg>`;
  }

  // Twitch
  if (url.includes("twitch.tv")) {
    return `
<svg class="icon-svg twitch" viewBox="0 0 2400 2800">
  <path fill="currentColor" d="M500,0L0,500v1800h600v500l500-500h400l900-900V0H500z M2200,1300l-400,400h-400l-350,350v-350H600V200h1600V1300z"/>
  <rect fill="currentColor" x="1700" y="550" width="200" height="600"/>
  <rect fill="currentColor" x="1150" y="550" width="200" height="600"/>
</svg>`;
  }

  // TikTok
  if (url.includes("tiktok.com")) {
    return `
<svg class="icon-svg tiktok" viewBox="0 0 2400 2752.1">
  <path fill="currentColor" d="M2041.53,551.65c-148.25-96.66-255.24-251.32-288.62-431.59-7.21-38.96-11.17-79.04-11.17-120.06h-473.15l-.76,1896.2c-7.96,212.34-182.72,382.77-396.96,382.77-66.59,0-129.29-16.65-184.49-45.7-126.6-66.62-213.23-199.31-213.23-352.03,0-219.31,178.43-397.74,397.73-397.74,40.94,0,80.21,6.75,117.36,18.39v-483.03c-38.44-5.23-77.5-8.5-117.36-8.5C390.66,1010.35,0,1401.03,0,1881.24c0,294.63,147.2,555.37,371.78,713.03,141.45,99.31,313.51,157.83,499.09,157.83,480.2,0,870.87-390.66,870.87-870.87v-961.53c185.57,133.2,412.93,211.68,658.26,211.68v-473.14c-132.15,0-255.24-39.29-358.47-106.6h0Z"/>
</svg>`;
  }

  // fallback
  return `
  <svg class="icon-svg link" viewBox="0 0 24 24">
    <path fill="currentColor" d="M10 14a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/>
    <path fill="currentColor" d="M14 10a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/>
  </svg>`;
}

    // Xアイコン
    function getXIcon() {
      return `
<svg class="icon-svg x" viewBox="0 0 1200 1227">
  <path fill="currentColor" d="M714.16,519.28L1160.89,0h-105.86l-387.89,450.89L357.33,0H0l468.49,681.82L0,1226.37h105.87l409.63-476.15,327.18,476.15h357.33l-485.86-707.09h.03ZM569.16,687.83l-47.47-67.89L144.01,79.69h162.6l304.8,435.99,47.47,67.89,396.2,566.72h-162.6l-323.31-462.45v-.03Z"/>
</svg>
      `;
    }

    // 役職色
    function getRoleStyle(color) {
      const map = {
        default: "#f0efed",
        gray: "#e6e5e3",
        brown: "#ebdfd7",
        orange: "#f3ddcb",
        yellow: "#f2e3b7",
        green: "#d7e6dd",
        blue: "#cbe3f7",
        purple: "#e8dbf2",
        pink: "#f4d8e4",
        red: "#f7d9d5"
      };

      const bg = map[color] || "#999";

      return `
        background: ${bg};
      `;
    }
    
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      }
    });

    const data = await notionRes.json();

    const members = data.results.map(page => {
      const p = page.properties;

      const name = p["名前"]?.title?.[0]?.plain_text || "";
      const yomi = p["よみがな"]?.rich_text?.[0]?.plain_text || "";
      const order = p["管理用"]?.number ?? 9999;

      const x = p["X"]?.url || "";
      const main = p["配信"]?.url || "";
      const sub = p["配信サブ"]?.url || "";
      const other = p["その他URL"]?.url || "";

      const roles = p["役職"]?.multi_select?.map(r => ({
        name: r.name,
        color: r.color
      })) || [];

      let image = "";
      const file = p["画像"]?.files?.[0];
      if (file) {
        image = file.type === "external" ? file.external.url : file.file.url;
      }

      return { name, yomi, order, x, main, sub, other, roles, image };
    });

    members.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.yomi.localeCompare(b.yomi, "ja");
    });

    const html = `
<html>
<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">

<style>
:root {
  --text-color-1: #523f31;
  --text-color-2: #755a46;
}

body {
  margin: 0;
  padding: 24px;
  font-family: "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text-color-1);
  background: rgba(0,0,0,0);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08);
}

/* 画像ラッパー（3:2固定） */
.image-wrap {
  width: 100%;
  aspect-ratio: 3 / 2;
  overflow: hidden;
}

/* 画像トリミング */
.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-bottom {
  padding: 12px 16px 16px 16px;
  text-align: left;
}

.name {
  font-weight: 700;
}

.yomi {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color-2);
}

.links {
  margin: 12px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 24px;
  margin: 0px 0px 0px -2px;
}

.role {
  font-weight: 500;
  color: var(--text-color-1);
  display: inline-flex;
  align-items: center;
  padding: 0.75px 10px 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--text-color-1);
}

/* アイコン */
/* 共通 */
.icon-svg {
  color: #523f31;
  transition: transform 0.15s ease;
}

/* 個別 */
.icon-svg.x {
  height: 15pt;
}

.icon-svg.youtube {
  height: 12pt;
}

.icon-svg.twitch {
  height: 18pt;
}

.icon-svg.tiktok {
  height: 18pt;
}

/* hover */
.icon:hover .icon-svg {
  transform: scale(1.20);
}

/* その他URL */
.other {
  margin-bottom: 14px;
  font-size: 12px;
  word-break: break-word;
  overflow-wrap: anywhere;
  transition: transform 0.15s ease;
}

.other a {
  color: var(--text-color-1);
  text-decoration: underline;
}

.other a:hover {
  color: var(--text-color-2);
}

</style>
</head>

<body>

<div class="grid">
${members.map(m => `
<div class="card">
  ${m.image ? `
  <div class="image-wrap">
    <img class="avatar" src="${m.image}">
  </div>` : ""}

  <div class="card-bottom">
    <div class="name">${escapeHtml(m.name)}</div>
    <div class="yomi">${escapeHtml(m.yomi)}</div>
    
    <div class="links">
      ${m.x ? `<a class="icon" href="${m.x}" target="_blank">${getXIcon()}</a>` : ""}
      ${m.main ? `<a class="icon" href="${m.main}" target="_blank">${getPlatformIcon(m.main)}</a>` : ""}
      ${m.sub ? `<a class="icon" href="${m.sub}" target="_blank">${getPlatformIcon(m.sub)}</a>` : ""}
    </div>

    ${m.other ? `
      <div class="other">
        <a href="${m.other}" target="_blank">${escapeHtml(formatUrl(m.other))}</a>
      </div>
    ` : ""}
    
    <div class="roles">
     ${m.roles.map(r => `
      <span class="role" style="${getRoleStyle(r.color)}">
        ${escapeHtml(r.name)}
      </span>
    `).join("")}
    </div>
  </div>
</div>
`).join("")}
</div>

</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
