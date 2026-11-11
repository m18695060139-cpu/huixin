# 回信 Re:

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
| `src/apikey.js` | 只读 API 密钥：生成 / 作废、`GET /api/v1/export` |
| `src/importer.js` | 从旧版 Life OS 备份导入 |
| `migrations/` | D1 数据库结构 |

## 只读 API（给自己的 agent 读数据）

用户在「设置 → API 密钥」里自己生成一把密钥（每人一把，重新生成即作废旧的）。库里只存 SHA-256，完整密钥只在生成时显示一次。

```bash
curl -H "Authorization: Bearer hx_…" "https://huixin.m18695060139.workers.dev/api/v1/export?since=2026-11-01&type=letters,todos"
```

- 只有 GET，返回这把密钥主人的 `letters`（含回信）、`todos`、`ideas`、`habits` + `habit_logs`、`digests`（周信 / 季信 / 年信）。
- `since=YYYY-MM-DD`：只要这天以后的（信按日期，待办 / 点子按创建或更新日期，打卡按日期，总结信按生成日期；习惯本身总是全量）。
- `type=`：逗号分隔，取值同上五种，不写就是全部。
- 没带密钥、密钥不对或已作废：401。每把密钥每分钟最多 30 次，超了 429。

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

给别人演示前，把示例账号的数据按今天的日期重铺一遍（只动这个账号的信、待办、点子、习惯、周信季信年信，账号密码不变）。内容在 `scripts/demo-data.cjs`：一个人五六周的信，从「开会的间隙做设计」到决定换工作，旁边是跑步、早睡和画楼下的小店；和小程序 `cloudfunctions/demoSeed/data.js` 是同一个文件，改了要两边一起换：

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
