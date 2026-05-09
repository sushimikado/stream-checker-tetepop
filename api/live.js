export default async function handler(req, res) {
  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    function escapeHtml(str) {
      if (!str) return "";
      return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[m]);
    }

    // 1. Notionからのデータ取得（ここも少しキャッシュを意識）
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      next: { revalidate: 300 } // Notionの応答もキャッシュ可能なら設定
    });

    const notionData = await notionRes.json();
    const channelIds = notionData.results
      .map(page => page.properties["YouTubeChannelID"]?.rich_text?.[0]?.plain_text)
      .filter(Boolean);

    // 2. YouTube APIの呼び出しを並列化 + エラーハンドリング
    const results = await Promise.all(
      channelIds.map(async (channelId) => {
        try {
          // ライブ中かどうかを判定する最小限のクエリ
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${YOUTUBE_API_KEY}`;
          
          const r = await fetch(url);
          const data = await r.json();

          // クォータ超過などのエラーチェック
          if (data.error) {
            console.error(`YouTube API Error (${channelId}):`, data.error.message);
            return null;
          }

          const live = data.items?.[0];
          if (live) {
            return {
              title: live.snippet.title,
              url: `https://youtube.com/watch?v=${live.id.videoId}`,
              thumbnail: live.snippet.thumbnails?.medium?.url || ""
            };
          }
        } catch (err) {
          return null;
        }
        return null;
      })
    );

    const activeLives = results.filter(Boolean);

// ===== HTML =====
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
  width: 100%;
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08);
  transition: transform 0.15s ease;
}

.card-link {
  text-decoration: none;
  color: inherit;
  display: block;
  height: 100%;
}

.card-link:hover .card {
  transform: translateY(-3px);
  box-shadow: 4px 6px 16px rgba(0,0,0,0.12);
}

.card-bottom {
  padding: 12px 16px 16px 16px;
  text-align: left;
  flex-grow: 1;
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

  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  overflow: hidden;
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

      <div class="title">
        配信中の参加者がここに表示されます
      </div>
    </div>
  </div>

  <div class="card">
    <div class="thumb-empty">
      STANDBY
    </div>

    <div class="card-bottom">
      <span class="live-badge-empty">● INFO</span>

      <div class="title">
        API制限により情報が取得されない場合があります
      </div>
    </div>
  </div>

</div>
`

: `
<div class="grid">

${results.map(v => {
  const title = escapeHtml(v.title);

  return `
<a href="${v.url}" target="_blank" class="card-link">

  <div class="card">

    <img class="thumb" src="${v.thumbnail}">

    <div class="card-bottom">
      <span class="live-badge">● YouTube</span>

      <div class="title">
        ${title}
      </div>
    </div>

  </div>

</a>
`;
}).join("")}

</div>
`
}

</div>

</body>
</html>
`;

// 3. 強力なキャッシュ制御
    // s-maxage: VercelのCDNに5分間キャッシュさせる
    // stale-while-revalidate: キャッシュが切れた後、裏で更新しつつ古いデータを1分間許容する
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.status(200).send(html);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
