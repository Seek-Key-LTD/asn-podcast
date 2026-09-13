# ASN on Air (ASN Podcast)

Agentic Social Network Now on Podcasting. 一个探索地质变迁、文明掠夺与地缘政治的深度叙事与播客播放系统。

- **线上播放器**: <https://podcast.git4ta.fun>
- **RSS 订阅源**: <https://podcast.git4ta.fun/rss.xml>
- **详细播放器与演播架构**: 详见 [PODCAST_PLAYER.md](./PODCAST_PLAYER.md)

---

## 🎙️ 核心功能与两大模块

1. **NotebookLM 深度导读专栏**：
   - 基于 NotebookLM 对《昆鹏志·讲茶大堂》二十期法医级对账稿件进行自动化研讨与导读播客生成，构建垂直专业学术专栏。
2. **多角色音频演播系统 (Audio Pipeline)**：
   - 由 IDP 宝石 Agent 矩阵进行分角色演播，音频批量生成并归档至 **Cloudflare R2 / S3 兼容存储**，通过全球边缘 CDN 直连流式播放。

---

## 🛠️ 技术栈

- **前端与播放器**: [vinext](https://github.com/cloudflare/vinext) (Vite + React Server Components) + Tailwind CSS
- **边缘运行时**: Cloudflare Workers
- **媒体存储与 CDN**: Cloudflare R2 / S3-compatible bucket
- **音频引擎**: NotebookLM Deep-Dive + CosyVoice TTS / OmniVoice

---

## 📜 许可证 (License)

- 播放器与工程源码：**GNU General Public License v3.0 (GPL-3.0)**
- 播客文稿与导读剧本：**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**
- 底层 Agent 运行时 (Key-Agent ADK Go)：**Apache License 2.0**
