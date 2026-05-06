export default async function handler(req, res) {
  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    function escapeHtml(str) {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    const notionRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      }
    });

    const notionData = await notionRes.json();

    const channelIds = notionData.results
      .map(page => {
        const prop = page.properties["YouTubeChannelID"];
        if (!prop || !prop.rich_text || prop.rich_text.length === 0) return null;
        return prop.rich_text[0].plain_text;
      })
      .filter(Boolean);

    const results = [];

for (const channelId of channelIds) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=5&key=${YOUTUBE_API_KEY}`;

  const r = await fetch(url);
  const data = await r.json();

  const live = (data.items || []).find(
    v => v.snippet?.liveBroadcastContent === "live"
  );

  if (live) {
    results.push({
      title: live.snippet.title,
      url: `https://youtube.com/watch?v=${live.id.videoId}`,
      thumbnail: live.snippet.thumbnails?.medium?.url || ""
    });
  }
}

const html = `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
:root {
  --text-color-1: #523f31;
  --text-color-2: #755a46;
  --bg-color: #FFD633;
}

body {
  margin: 0;
  padding: 16px;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* コンテナ */
.wrapper {
  max-width: 1100px;
  margin: 0 auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08);
}

.card-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.card-link:hover .card {
  transform: translateY(-3px);
  box-shadow: 4px 6px 16px rgba(0,0,0,0.12);
}

.card-bottom {
  padding: 12px 16px 16px 16px;
  text-align: left;
}

/* サムネ */
.thumb {
  width: 100%;
  display: block;
}

.thumb-empty {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  background: #AAAAAA;
  font-size: 21px;
  font-weight: 700;
  color: #CCCCCC;
  justify-content: center;
  align-items: center;
}

/* コンテンツ */
.content {
  padding: 16px;
}

/* LIVEバッジ */
.live-badge {
  display: inline-block;
  background: #ff3b30;
  color: white;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin: 0px 0px 6px -2px;
}

.live-badge-empty {
  display: inline-block;
  background: #666666;
  color: white;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin: 0px 0px 6px -2px;
}

/* タイトル */
.title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  width: 100%;
}

/* 空状態 */
.empty {
  color: #666;
  font-size: 14px;
}
</style>
</head>

<body>
<div class="wrapper">
${
results.length === 0
? `
<div class="grid">
  <div class="card">
    <div class="thumb-empty">
      STANDBY
    </div>
    <div class="card-bottom">
      <span class="live-badge-empty">● INFO</span>
      <div class="title">配信中の参加者がここに表示されます</div>
    </div>
  </div>

  <div class="card">
    <div class="thumb-empty">
      STANDBY
    </div>
    <div class="card-bottom">
      <span class="live-badge-empty">● INFO</span>
      <div class="title">API制限により情報が取得されない場合があります</div>
    </div>
  </div>
</div>
`

: `
<div class="grid">
${results.map(v => {
  const title = escapeHtml(v.title);

  return `
<div class="card-link">
  <img class="thumb" src="${v.thumbnail}">
  <div class="card-bottom">
    <span class="live-badge">● YouTube</span>
    <div class="title">${title}</div>
  </div>
</div>
`;
}).join("")}
</div>
`
}

</div>

</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(html);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
