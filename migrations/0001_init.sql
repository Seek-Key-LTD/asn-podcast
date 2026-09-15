-- 0001_init.sql
--
-- 剧集目录从 KV 迁到 D1。
--
-- 背景：KV 时代用 `content:{env}:hacker-podcast:{YYYY-MM-DD}` 存整条 JSON，
-- 日期同时充当主键、URL slug、排序键、展示日期。对「每天一行」是对的，
-- 但《三更道场》这类有期次编号的系列剧（S01E04、S01E08.5）被日期轴压住了
-- 排序——E8.5 会卡在错误的位置。这张表把「身份」和「日期」拆开。
--
-- 约定：
--   * 时间列一律 Unix epoch **毫秒**，与 types/article.d.ts 的 updatedAt 一致。
--     用 `>= 1000000000000` 的 CHECK 拦掉误传秒或日期字符串（静默 1000× bug）。
--   * 所有读查询必须带 env 过滤。KV 时代 dev/prod 靠键前缀隔离，这里靠 env 列；
--     漏过滤会让 NODE_ENV=development 的管线产出混进线上列表。

CREATE TABLE series (
  id          TEXT    PRIMARY KEY NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  cover       TEXT,
  feed_slug   TEXT    NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE episodes (
  env             TEXT    NOT NULL DEFAULT 'production',
  -- URL 路径，唯一身份。daily 用日期，series 用 `<feed_slug>/s01e04`
  slug            TEXT    NOT NULL,
  kind            TEXT    NOT NULL CHECK (kind IN ('daily', 'series')),
  -- 仅 daily：YYYY-MM-DD，且必须等于 slug
  date            TEXT,
  -- 迁移前用过的 URL 路径，仅用于 308 重定向
  legacy_slug     TEXT,
  series_id       TEXT    REFERENCES series(id),
  -- 展示标签，如 'S01E08.5'
  episode_no      TEXT,
  -- 排序三件套：不依赖字符串字典序，S01E08.5 自然落在 E8 与 E10 之间
  season          INTEGER,
  episode_major   INTEGER,
  -- > 0 即番外集，会映射成 itunes:episodeType = bonus
  episode_minor   INTEGER,
  title           TEXT    NOT NULL,
  summary         TEXT    NOT NULL DEFAULT '',
  intro_content   TEXT    NOT NULL DEFAULT '',
  blog_content    TEXT    NOT NULL DEFAULT '',
  podcast_content TEXT    NOT NULL DEFAULT '',
  stories_json    TEXT    NOT NULL DEFAULT '[]',
  tags_json       TEXT    NOT NULL DEFAULT '[]',
  audio_url       TEXT    NOT NULL,
  audio_bytes     INTEGER,
  duration_sec    REAL,
  published_at    INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  -- 复合主键：env 打头，避免 dev 行与 prod 行在 slug 上互相覆盖
  PRIMARY KEY (env, slug),
  -- 两种形状各自的不变量。SQLite 的 TEXT PRIMARY KEY 在 rowid 表里允许 NULL，
  -- 所以每列都要显式判 NOT NULL 才能挡住「野行」。
  CHECK (
    (kind = 'daily'
      AND date IS NOT NULL AND slug = date
      AND series_id IS NULL AND episode_no IS NULL
      AND season IS NULL AND episode_major IS NULL AND episode_minor IS NULL)
    OR
    (kind = 'series'
      AND date IS NULL
      AND series_id IS NOT NULL AND episode_no IS NOT NULL
      AND season >= 1 AND episode_major >= 1 AND episode_minor >= 0)
  ),
  CHECK (published_at >= 1000000000000),
  CHECK (updated_at   >= 1000000000000)
);

-- 同一系列内期次标签唯一
CREATE UNIQUE INDEX idx_ep_series_no
  ON episodes(env, series_id, episode_no);

-- 同一系列内排序位唯一——防止两期抢同一个位置（E8.5 那个 bug 的根）
CREATE UNIQUE INDEX idx_ep_series_pos
  ON episodes(env, series_id, season, episode_major, episode_minor);

-- 日报分页：WHERE env=? AND kind='daily' ORDER BY date DESC LIMIT ? OFFSET ?
CREATE INDEX idx_ep_daily_date
  ON episodes(env, date DESC) WHERE kind = 'daily';

-- 系列剧全集：WHERE series_id=? ORDER BY season, major, minor
-- D1/SQLite 不会为外键自动建索引，所以这条要手建
CREATE INDEX idx_ep_series_read
  ON episodes(series_id, season, episode_major, episode_minor);

-- 旧 URL 解析（只索引非空的）
CREATE UNIQUE INDEX idx_ep_legacy
  ON episodes(legacy_slug) WHERE legacy_slug IS NOT NULL;
