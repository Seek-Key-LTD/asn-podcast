/**
 * 运行时环境变量的类型补充。
 *
 * 为什么不写进 wrangler.jsonc 的 `vars`：
 *   dashboard 才是这几个值的真相来源（配置里的 `keep_vars: true` 就是为此）。
 *   一旦写进配置文件，部署时配置会反过来覆盖 dashboard —— 那是行为变更，
 *   不该混在类型修正里做。
 *
 * 为什么不写进 cloudflare-env.d.ts：
 *   那个文件是 `pnpm cf-typegen` 的产物，每次跑都会被重新生成。
 *   往里加手写内容会在下次 typegen 时被静默抹掉。
 *
 * 所以用接口合并单独声明，并且**一律标成可选** —— 这是对现实的准确描述：
 * 线上 `asn-podcast` 这个 worker 只绑了 KV 和 D1，这几个 var 一个都没绑，
 * 运行时取到的就是 undefined。调用方必须各自兜底。
 */

declare namespace Cloudflare {
  interface Env {
    /** 运行环境分区键。未绑定时读侧按 'production' 处理（见 lib/articles.ts）。 */
    NODE_ENV?: string

    /**
     * 音频静态主机前缀，用于拼接相对路径。
     * 当前所有 audio 都以绝对 URL 入库（见 KV/D1 的 audio_url），所以实际不生效；
     * 保留是因为 buildAudioUrl 仍需支持相对路径的将来可能。
     */
    NEXT_STATIC_HOST?: string

    /** 可选的 1×1 追踪像素前缀，仅当配置了才在 RSS 里注入。 */
    NEXT_TRACKING_IMAGE?: string
  }
}
