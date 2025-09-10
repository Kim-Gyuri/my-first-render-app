const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 정적 파일 서빙
app.use(express.static('public'));

// 아이템 목록 API
// 아이템 목록 API
app.get("/api/items/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0; 
    const size = parseInt(req.query.size) || 8;
    const offset = page * size;

    const character = req.query.character || null; // 캐릭터 필터 조건

    let query = `
      SELECT 
        i.item_id,
        i.name_kor,
        i.price,
        i.description,
        ii.img_url AS thumbnail,   -- 대표 이미지
        COALESCE(
          json_agg(ht.tag_option) FILTER (WHERE ht.tag_option IS NOT NULL),
          '[]'
        ) AS tags
      FROM item i
      LEFT JOIN item_img ii 
        ON i.item_id = ii.item_id AND ii.is_main_img = 'Y'
      LEFT JOIN hash_tag ht 
        ON i.item_id = ht.item_id
    `;

    // 캐릭터 조건 있으면 WHERE 추가
    if (character) {
      query += ` WHERE i.character = $3 `;
    }

    query += `
      GROUP BY i.item_id, ii.img_url
      ORDER BY i.item_id DESC
      LIMIT $1 OFFSET $2
    `;

    const params = [size, offset];
    if (character) params.push(character);

    const { rows } = await pool.query(query, params);

    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
});


app.listen(PORT, () => {
  console.log(`서버 실행 중 http://localhost:${PORT}`);
});
