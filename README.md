> ⚠️ 本分支（miniprogram）是【微信小程序版本】，代码在 miniprogram-app/ 目录。网页版（Cloudflare Workers）在 main 分支，两者独立，请勿合并。

# 回信

每晚写一封信给自己，AI 替未来的你回信。

- 你只写一件事：每天的信。习惯打卡是唯一的手动动作。
- 回信写成一封信，并拆出精力 / 情绪、健康 / 精力 / 事业 / 关系四个角度、待办、点子。那 7 个问题写进正文里，不再单独列出回答。
- 每周一早上自动送周信，季初送季信，元旦送年信。

## 结构

| 位置 | 内容 |
|---|---|
| `public/` | 前端（今天 / 写信 / 信箱 / 设置，四套外观，离线缓存，iPhone 主屏幕 App） |
| `src/worker.js` | Cloudflare Worker：接口、回信、周信季信、定时任务 |
| `src/ai.js` | 回信与周信的提示词，模型走 OpenAI 兼容网关 |
| `src/importer.js` | 从旧版 Life OS 备份导入 |
| `migrations/` | D1 数据库结构 |

## 部署

```bash
npm install
# Cloudflare 令牌放在 .env.deploy（不进仓库）
set -a && . ./.env.deploy && set +a && npx wrangler deploy
```

Windows 上双击 `deploy.bat`。

AI 的 Key：`npx wrangler secret put AI_API_KEY`。

新建账号：`node scripts/create-user.mjs <账号> <密码> [名字]` 生成 SQL，再 `npx wrangler d1 execute huixin --remote --command "<SQL>"`。

## 示例账号

给别人演示前，把示例账号的数据按今天的日期重铺一遍（只动这个账号的信、待办、点子、习惯、周信季信，账号密码不变）：

```bash
node scripts/demo-reset.mjs <示例账号> [回信怎么称呼] > demo.sql
npx wrangler d1 execute huixin --remote --file demo.sql
```

重铺后，「昨晚的你来信了」的信封在任何设备上都会重新出现。

## 本地开发

```bash
echo 'MOCK_AI = "1"' > .dev.vars   # 用假回信，不调用模型
npx wrangler d1 migrations apply huixin --local
npx wrangler dev
```
