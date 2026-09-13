# ASN Podcast Player & Audio Pipeline (播客播放器与音频演播架构)

> **仓库定位**：`Seek-Key-LTD/asn-podcast`  
> **服务终端**：<https://podcast.git4ta.fun>  
> **主线定位**：NotebookLM 深度导读专栏 ＋ 多 Agent 角色音频演播系统 ＋ Cloudflare R2 / S3 存储归档流水线

---

## 🎙️ 核心业务与两大支柱

### 1. 垂直导读专栏（NotebookLM Deep-Dive Column）
- 将《昆鹏志·讲茶大堂》五卷正典、二十期学术对账与地缘法医学正稿灌入 **NotebookLM**。
- 自动生成双人/多人深度探讨口播导读脚本与播客音频。
- 作为全网第一条面向地质变迁、文明掠夺与地缘政治法医学分析的垂直专栏播客。

### 2. 角色化演播系统（Audio Performance Pipeline）
- **多智能体演播**：结合本地与云端 TTS（CosyVoice / 角色声音模型），由 IDP 宝石 Agent（Ruby, Sapphire 等）分角色进行全本演播。
- **存储归档**：批量生成的数十期节目音频直接落地并归档至 **Cloudflare R2 (S3 兼容存储)**，通过全球边缘 CDN 流式分发。
- **前端播放器**：基于 Vinext (React Server Components) + Cloudflare Workers，提供轻量、高响应、支持波形与章节跳转的 Web Podcast Player 与标准 RSS Feed。

---

## 🛠️ 技术架构与流水线

```
[讲茶大堂 / 昆鹏志正稿] ──> [NotebookLM 导读生成] ──> [音频切片 / 元数据对账]
                                                              │
[IDP 宝石 Agent 角色配音] ──> [TTS 演播系统 (CosyVoice)] ───────┘
                                                              │
                                                              ▼
                                                   [Cloudflare R2 (S3)]
                                                              │
                                                              ▼
                                               [ASN Web Player / RSS]
                                              (https://podcast.git4ta.fun)
```

---

## 📜 版权与开源声明 (License Notice)

本工程遵循多层开源与知识共享协议体系：

1. **播放器源码与工程代码 (Player & Pipeline Source Code)**：
   - 遵循 **[GNU General Public License v3.0 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html)**。
2. **文本正稿、法医手稿与导读剧本 (Scripts & Forensic Manuscripts)**：
   - 遵循 **[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)**。
3. **Key-Agent 运行时基础 (Key-Agent ADK Go Base)**：
   - 保持 **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**。
