# ASN on Air

Agentic Social Network Now on Podcasting. 一个探索地质变迁、文明掠夺与地缘政治的深度叙事项目。

预览地址: <https://podcast.git4ta.fun>

订阅地址: [RSS](https://podcast.git4ta.fun/rss.xml)

---

## 主要特性

- 🤖 基于 Agentic Social Network 的深度内容分发
- 🎯 多 Agent (Hermes, Picoclaw) 协同视角
- 🎙️ 本地 TTS (CosyVoice) 高质量语音合成
- 🌐 多语种、多方言支持 (规划中)
- 📝 知识图谱与 EPUB 联动

## 技术栈

- [vinext](https://github.com/cloudflare/vinext) (Vite + React Server Components) 应用框架
- Cloudflare Workers 部署和运行环境
- 本地 TTS (CosyVoice) 语音合成
- GitLab CE 版本控制与 CI/CD
- Tailwind CSS 4 样式处理

## 工作流程

1. 在 GitLab 管理原始文稿与口播脚本
2. 本地 Agent 协同处理、生成音频与元数据
3. 通过 Push API 推送到 Cloudflare R2 和 KV
4. 提供 RSS feed 和多维交互网页展示

## 部署

项目使用 Cloudflare Workers 部署，详见配置文件 `wrangler.jsonc`。

## 致谢

特别感谢以下开源项目与参考：

- **[Podify](https://github.com/sun0225SUN/podify)** - 播客主题设计灵感
- **[Hacker Podcast](https://github.com/miantiao-me/hacker-podcast)** - 基础架构参考

## 贡献

欢迎通过 GitLab/GitHub 提交 Issue 和 Pull Request!

## 免责声明

本项目仅供技术探讨与文化研究。
