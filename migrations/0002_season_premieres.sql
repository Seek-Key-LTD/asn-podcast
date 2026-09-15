-- 0002_season_premieres.sql
--
-- 两件事：
--   1) 把 series.id 从 'sangeng-s1' 正名为 'sangeng'
--   2) 建 season_premieres，给尚未开播的季留下位置
--
-- 关于 1：id 里带季号是早期建模的遗留。feed 从一开始就是整部剧的
-- （/series/sangeng/rss.xml），季的表达应该是 episodes.season 那一列——
-- 订阅一次、跨季不断，才是播客该有的行为。留着 '-s1' 会让
-- app/episode/[...slug]/page.tsx 里多出一句 `replace(/-s\d+$/, '')` 的猜测。
--
-- 改主键要小心两件事：
--   * series.feed_slug 上有 UNIQUE，所以不能「先插新行再删旧行」——新行的
--     feed_slug 与旧行相同，插入当场就撞唯一约束。
--   * PRAGMA defer_foreign_keys 在这里救不了场：它是**事务级**的，而 D1 每条
--     语句是隐式事务，下一句就失效了。所以外键必须每一步都保持有效。
--
-- 因此走「先腾出 feed_slug → 插新行 → 迁引用 → 删旧行」，每步都 FK 安全：
--   (1) 旧行的 feed_slug 先改成一个占位值，唯一约束腾空，且此时引用它的
--       episodes 仍然指向有效的 series 行；
--   (2) 插入新行（id 与 feed_slug 都是 'sangeng'）；
--   (3) 把 episodes 的引用迁到新行——这一步之后旧行已无人引用；
--   (4) 删掉旧行。

UPDATE series SET feed_slug = 'sangeng-migrating-0002', updated_at = updated_at
WHERE id = 'sangeng-s1';

-- 标题也要改：series 现在代表**整部剧**，不该再叫"第一季"。季由
-- episodes.season 表达（feed 里体现为 itunes:season），所以标题收敛成剧名。
INSERT INTO series (id, title, description, cover, feed_slug, sort_order, created_at, updated_at)
SELECT 'sangeng', '三更道场', description, cover, 'sangeng', sort_order, created_at, updated_at
FROM series
WHERE id = 'sangeng-s1';

UPDATE episodes SET series_id = 'sangeng' WHERE series_id = 'sangeng-s1';

DELETE FROM series WHERE id = 'sangeng-s1';


-- 尚未开播的季。
--
-- 为什么要单独一张表而不是给 series 加列：一个 series 会有多季，而
-- "预计上线"是每季一个值。塞进 series 的话，S3 的信息就没地方放了。
CREATE TABLE season_premieres (
  series_id    TEXT    NOT NULL REFERENCES series(id),
  season       INTEGER NOT NULL CHECK (season >= 1),
  -- Unix 毫秒；NULL = 待定（客户端显示"待定"而不是假日期）
  premieres_at INTEGER,
  -- 日期依据，如"立冬"
  note         TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (series_id, season)
);

-- 用条件插入而不是直接 VALUES：全新数据库跑 0001+0002 时 series 还是空的，
-- 无条件的 INSERT 会撞外键。有数据时才补这两行。
--
-- 两个日期：S2 立冬（2026-11-07 17:51:46 CST，已用寿星公式与公开数据交叉核对）；
-- S3 立春（2027-02-04）—— 取"一年之计在于春"的意头，主理人可随时改。
INSERT INTO season_premieres (series_id, season, premieres_at, note)
SELECT 'sangeng', 2, 1794045106000, '立冬'
WHERE EXISTS (SELECT 1 FROM series WHERE id = 'sangeng');

INSERT INTO season_premieres (series_id, season, premieres_at, note)
SELECT 'sangeng', 3, 1801699200000, '立春'
WHERE EXISTS (SELECT 1 FROM series WHERE id = 'sangeng');
