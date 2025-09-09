const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Render PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render에서 필요
});


// 아이템 목록 조회 API (무한 스크롤)
app.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // 요청 페이지
    const limit = parseInt(req.query.limit) || 20; // 한 번에 불러올 개수
    const offset = (page - 1) * limit;

    // item과 hash_tag를 조인해서 조회
    const query = `
      SELECT i.item_id, i.name_kor, i.price, i.description,
             COALESCE(json_agg(ht.tag_option) FILTER (WHERE ht.tag_option IS NOT NULL), '[]') AS tags
      FROM item i
      LEFT JOIN hash_tag ht ON i.item_id = ht.item_id
      GROUP BY i.item_id
      ORDER BY i.item_id DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(query, [limit, offset]);

    res.json({
      page,
      limit,
      items: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
});

app.listen(PORT, () => {
  console.log(`서버 실행 중 http://localhost:${PORT}`);
});