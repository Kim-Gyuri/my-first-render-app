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

// 검색 api 요청 
app.get("/api/items/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 8;
    const offset = page * size;

    const selectedCharacter = req.query.character || null; // 선택된 산리오 캐릭터
    const selectedTag = req.query.tag || null; // 선택된 태그
    const keyword = req.query.keyword || null; // 상품명 검색 키워드

    const params = [];
    let whereClauses = []; // WHERE 조건을 담을 배열

    let query = `
      SELECT 
        i.item_id,
        i.name_kor,
        i.price,
        i.description,
        ii.img_url AS thumbnail,
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

    // 캐릭터 필터
    if (selectedCharacter) {
      params.push(selectedCharacter);
      whereClauses.push(`i.sanrio_characters = $${params.length}`);
    }

    // 태그 필터
    if (selectedTag) {
      params.push(selectedTag);
      whereClauses.push(`EXISTS (
        SELECT 1 
        FROM hash_tag h 
        WHERE h.item_id = i.item_id AND h.tag_option = $${params.length}
      )`);
    }

    // 상품명 키워드 검색 (부분 일치)
    if (keyword) {
      params.push(`%${keyword}%`);
      whereClauses.push(`i.name_kor LIKE $${params.length}`);
    }

    // WHERE 절 결합
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // GROUP BY, ORDER BY, LIMIT/OFFSET
    params.push(size, offset);
    query += `
      GROUP BY i.item_id, ii.img_url
      ORDER BY i.item_id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await pool.query(query, params);
    res.json({ items: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
});


// 카테고리 api
app.get("/api/items/category", async (req, res) => {
  const { category, subcategory } = req.query;

  try {
    const query = `
      SELECT 
          i.item_id,
          i.name_kor,
          i.price,
          i.description,
          i.sub_category,
          ii.img_url AS thumbnail,
          COALESCE(
              json_agg(ht.tag_option) FILTER (WHERE ht.tag_option IS NOT NULL),
              '[]'
          ) AS tags
      FROM item i
      LEFT JOIN item_img ii 
          ON i.item_id = ii.item_id AND ii.is_main_img = 'Y'
      LEFT JOIN hash_tag ht 
          ON i.item_id = ht.item_id
      WHERE i.main_category = $1 
        AND i.sub_category = $2
      GROUP BY i.item_id, ii.img_url
      ORDER BY i.item_id DESC
    `;

    const values = [category, subcategory];
    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
});



app.listen(PORT, () => {
  console.log(`서버 실행 중 http://localhost:${PORT}`);
});
