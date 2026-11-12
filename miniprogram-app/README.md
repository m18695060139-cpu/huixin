# 回信小记 · 微信小程序

这是网页版「回信」的**微信小程序**，登记名称是**回信小记**。个人主体，类目「工具 - 备忘录」。它只跑在微信里，后端是**微信云开发**（云函数 + 云数据库），不需要自己的域名。

网页版（Cloudflare Workers）在仓库的 `main` 分支。两边是两本独立的本子：**不要把这个分支合并进 main**，也不要在这边改 `src/`、`public/` 那些网页文件。

本分支定位是**只有自己看得见**的每日记录：写信、回信、待办、点子、习惯、信箱和外观。没有分享、没有广场。回信、周信、季信、年信由云开发里的混元来写，只在体验版使用。

## 和网页版的差别

| | 小程序（本分支） | 网页版（main） |
|---|---|---|
| 代码 | `miniprogram-app/` | `public/`、`src/`、`migrations/` |
| 登录 | 微信 OpenID，云函数里读取 | 账号密码 |
| 数据 | 微信云开发，境内 | Cloudflare D1 |
| 回信 | 云函数 `reply` 调混元，提示词与网页版相同 | 网页版自己的模型 |
| 心情 / 精力 | 回信写完后写入这封信 | AI 打分 |
| 待办 / 点子 | 回信拆出来，也可以自己加 | 同一套 |
| 周信季信年信 | 云函数 `digest`，每天 6:00（北京时间）定时 | 同一套，Cloudflare cron |

## 目录

| 路径 | 内容 |
|---|---|
| `miniprogram/` | 小程序前端。`config.js` 的 `ENV_ID` 为 `huixin-d1g2tdmkz68dc5a5d` |
| `miniprogram/pages/` | 今天、写信、信箱，以及信、列表、设置、隐私说明 |
| `cloudfunctions/` | `login`、`save`、`importFromWeb`、`wipe`、`reply`、`digest`、`demoSeed`、`api`（只读 API 密钥） |
| `docs/用户隐私保护指引.md` | 填到公众平台的隐私指引草稿 |
| `docs/数据库权限.json` | 六个集合的「仅创建者可读写」规则 |
| `scripts/upload.js` | 用 miniprogram-ci 上传代码并部署云函数 |
| `project.config.json` | AppID `wxb0105fcabc5187be`。`miniprogramRoot` 是 `miniprogram/`，`cloudfunctionRoot` 是 `cloudfunctions/`，用开发者工具直接打开本目录即可 |

外观变量来自 `public/app.css` 的四套主题：回信红、夜信、信笺、素笺，外加跟随系统。长度按 390 宽换算，`1px = 750/390 rpx`。首页底部的摘句是 30 天前自己信里的一句话（`.memo`），没有诗句库。

## 页面对照

网页版是一个单页，下面这些屏在小程序里拆开了，间距、颜色、圆角和卡片结构按原样式来。

| 网页版 | 小程序 |
|---|---|
| 今天（信封、待办、点子、30 天前的一句） | `pages/today`。没有诗句卡，习惯打卡在写信页 |
| 写信（纸、提示、习惯条、寄出、已寄出夜色页） | `pages/write`。寄出后后台写回信。没有语音 |
| 信箱（状态曲线、全部 / 周信 / 季信 / 年信） | `pages/mailbox`。周信卡片和「让回信写这一周的周信」 |
| 拆信 / 看某一天 | `pages/letter`。回信、附件、精力情绪高光、四个角度和有用 / 没用 |
| 周信 / 季信 / 年信正文 | `pages/digest` |
| 待办与点子、完成 / 放下 | `pages/lists` |
| 待办编辑、放下原因、点子编辑 | 组件 `components/editor`，从底部盖住当前页 |
| 设置（送达、AI 回信、外观、习惯、问题、账号） | `pages/settings`。AI 回信默认用云开发免费的混元，也可以接入自己的 OpenAI 兼容接口（和网页版同一套服务商）。账号区可以载入或清除示例数据 |
| （无） | `pages/privacy` 隐私说明；设置里可以导入网页版 JSON、清空全部数据 |
| 底部胶囊导航 | 自定义 tabBar：今天 / 写信 / 信箱 |

凌晨 4:00 前写的算前一天。当天 4:00 前寄出的信，封到第二天 6:00。首页在可以拆的时候显示信封。过了 4:00 再补的信，寄出后马上可以看回信。

首页「点一下换一句」只在有至少一封 30 天前的信、并且那封信里有 8 到 60 字的句子时出现。没有这样的信，这张卡片不显示。

## 在微信开发者工具里打开

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入项目，目录选本文件夹 `miniprogram-app`（里面有 `project.config.json`）。`miniprogramRoot` 指向 `miniprogram/`，`cloudfunctionRoot` 指向 `cloudfunctions/`，不用再改目录。
3. AppID 已写成 `wxb0105fcabc5187be`。用管理员微信登录开发者工具即可。
4. 云环境 ID 已写成 `huixin-d1g2tdmkz68dc5a5d`（`miniprogram/config.js`，云函数的 `cloud.init` 也是这个环境）。
5. 工具里对 `cloudfunctions` 下每个函数右键「上传并部署：云端安装依赖」。`reply`、`digest`、`demoSeed` 各做一次，否则拆信、周信和示例数据会找不到函数。或用下面的上传脚本。
6. 云开发控制台新建集合（第一次写入有时会自动出现）：`letters`、`todos`、`ideas`、`habits`、`habit_logs`、`settings`、`digests`。权限全部选 **仅创建者可读写**。规则原文在 `docs/数据库权限.json`。
7. 查询若提示缺索引，按开发者工具里的链接创建即可。周信按日期范围查库，建议在云开发控制台为这些字段建复合索引（代码不会替你建）：`letters` 的 `_openid + date`，`todos` 的 `_openid + done_at`、`_openid + dropped_at`、`_openid + updated_at`，`ideas` 的 `_openid + status + created`，`habit_logs` 的 `_openid + date`，`digests` 的 `_openid + kind + key`。

保存文字时，云函数 `save` 会调用 `cloud.openapi.security.msgSecCheck`（场景值 1，version 2）。判定为 risky：提示「内容包含不适合保存的信息，请修改后再存」，草稿留在输入框。review 或接口故障：仍保存，并在记录上做标记，不因为接口挡住你。

转发已关：每个页面 `wx.hideShareMenu`，没有 `onShareAppMessage`。

## 从网页版导入

网页版这个分支**没有**加导出按钮（不能改网页版文件）。在已登录的网页版里打开浏览器开发工具，请求 `GET /api/bootstrap`，把返回的 JSON 存成文件，发到微信「文件传输助手」。小程序「设置 → 选择 JSON 文件」会交给云函数 `importFromWeb`。

导入保留：信的正文、回信正文（`reply`）和写好的时间（`replied_at`）、周信季信年信、心情、精力、待办、点子、习惯和打卡、称呼、外观、自省问题。丢掉：账号密码。

已经导入过的账号，用同一个 JSON 再走一次「设置 → 选择 JSON 文件」即可补回信和周信。已经在小程序里的信、待办、点子、习惯不会被盖掉，也不会被删掉；只填当时空着的回信、`replied_at` 和还没有的周信季信年信。想看带回复的整套示例，用设置里的「载入示例数据」。

`/api/bootstrap` 只含最近大约 120 天的信和未完成的待办。文件里有多少，就进多少。

## 上传体验版

在 `miniprogram-app` 目录：

```bash
npm install
export APPID=wxb0105fcabc5187be
export ENV_ID=huixin-d1g2tdmkz68dc5a5d
export PRIVATE_KEY_PATH=/绝对路径/private.key
# APPID、ENV_ID 必须和 project.config.json、miniprogram/config.js 里的值相同
npm run upload
```

脚本使用 `miniprogram-ci`：上传代码，再对 `login`、`save`、`importFromWeb`、`wipe`、`reply`、`digest`、`demoSeed` 做 `uploadFunction`（云端安装依赖）。上传成功后，到公众平台 **管理 → 版本管理**，把该版本设为**体验版**。要打开的人加为体验成员（个人主体最多 15 人）。

代码上传密钥在公众平台「开发管理 → 开发设置」生成，不要提交到仓库。

## 混元回信（仅体验版）

个人主体不能把 AI 功能提交审核。开关只有一个：`miniprogram/config.js` 里的 `AI_ENABLED`，默认 `true`。送审前改成 `false`，拆信时就不会再请求回信，页面上也不出现回信块，设置里的「AI 回信」一节也会藏起来。

## 自己的 AI（OpenAI 兼容接口）

设置页「AI 回信」和网页版同一套选项：默认用云开发免费的混元；也可以选 DeepSeek、智谱、通义千问、Kimi、硅基流动、TokenHub、OpenRouter 或自定义，填接口地址、模型名和 API Key。接上之后，回信、周信、季信、年信都走用户自己的额度。自己的 AI 出错时自动改用混元，回信页会提示原因。

Key 用 AES-256-GCM 加密后存在云数据库集合 `ai_config`（按 openid 一份），小程序里只显示后 4 位，保存后再也看不到完整 Key。这个集合的权限必须设成「所有用户不可读写」，和 `api_keys` 一样。清空全部数据时会一并删掉。

相关云函数：

1. 新建的 `aiConfig`：查看、保存、测试、停用。要在开发者工具里对 `cloudfunctions/aiConfig` 右键 **上传并部署：云端安装依赖**。
2. `reply` 和 `digest` 已改为先调用户自己的接口，也要重新部署（云端安装依赖）。
3. `wipe` 会清掉 `ai_config`，改过之后也要重新部署。

云函数通过 HTTPS 出网调用用户填的地址（必须是 `https://`，90 秒在网页版、这里是 35 秒以便给混元回退留时间）。如果测试时提示「连不上这个接口地址」，到云开发控制台看一下这个环境是否开了云函数公网访问。

回信在云函数 `reply` 里生成，提示词不下发到手机，和网页版 `src/ai.js` 的回信提示一致。模型提供方是 `cloudbase`，对话模型常量是 **`hy3`**。若环境还不认 `hy3`，函数会再试一次文档示例里的 `hy3-preview`。寄出时就会写回信；若当时没写成，拆开时再试一次。封存到第二天 6:00 之前，首页不展示回信正文。失败或额度用完时，自己写的信还在，并可以再试。心情和精力以回信给出的为准。

周信、季信、年信在云函数 `digest`。`config.json` 里的定时触发器是 `0 0 6 * * * *`（名字 `digestAt6`），每天 06:00（北京时间）。和网页版一样：周一写上一周的周信，季度第一天写上一季，元旦写上一年。信箱里也可以手动让它现在写。日常回信仍是早上 6:00 拆开，和这个定时任务是两件事。

要在开发者工具里启用：

1. 在 `cloudfunctions/reply` 和 `cloudfunctions/digest` 上各右键一次 **上传并部署：云端安装依赖**。依赖要用 `wx-server-sdk` 4.0.1 及以上。`digest` 的定时触发器要等这次部署之后才会登记。
2. 云开发控制台确认这个环境开了 AI / 大模型，并且混元可用。小程序成长计划的免费 token 要发到环境 `huixin-d1g2tdmkz68dc5a5d`。入口一般在开发者工具的「云开发」面板。
3. 客户端文档（`wx.cloud.extend.AI.createModel`，模型目录里的名字是 `hy3`）：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/extensions/extend/ai/model.html
4. 云函数文档（`cloud.ai().createModel('cloudbase')`）：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-sdk-api/extend/ai/server.html

## 示例数据

设置页账号一节最底下有「载入示例数据」和「清除示例数据」。载入会把和网页版演示账号同一套内容（`cloudfunctions/demoSeed/data.js`，和网页版 `scripts/demo-data.cjs` 是同一个文件）写进**当前微信用户**自己的云数据库：一个人五六周的信和回信、待办（还没做 / 过期 / 做完 / 放下）、点子（还在 / 转成待办 / 放下）、四个习惯和打卡、五封周信、这一季和今年到目前为止的季信、年信。日期按北京时间的「今天」重算，所以「昨晚的你来信了」会重新出现。每条文档带 `demo: true`。同一天如果已经有你自己的信，就跳过那一天。清除只删 `demo: true` 的文档。

云函数 `demoSeed` 也要在开发者工具里对 `cloudfunctions/demoSeed` 右键 **上传并部署：云端安装依赖** 一次，否则这两个按钮会提示找不到函数。称呼如果还是空的，载入时会设成「非云」，清除时再改回去。

## 隐私与备案

隐私指引草稿：`docs/用户隐私保护指引.md`。联系邮箱需要你自己填。小程序里的「隐私说明」是同一份内容的短版。

只给自己用、不提交审核时，可以停留在体验版。一旦要公开发布，需要先完成个人小程序备案，并在提审备注里写明：个人每日记录与待办；内容仅当前用户可见；无分享、无社区；数据库按 openid 隔离；保存前已接入 msgSecCheck。

## 已填入的登记信息

- 小程序名称：**回信小记**（导航栏标题和隐私指引）。应用里说「写信 / 拆信 / 回信红」时，仍用「回信」指这封信。
- AppID：`wxb0105fcabc5187be`
- 云环境 ID：`huixin-d1g2tdmkz68dc5a5d`

上传还需要你本机的**代码上传密钥路径**（环境变量 `PRIVATE_KEY_PATH`）。隐私指引里的联系邮箱仍待填写。

## 本地检查

本仓库用 Node 做了语法检查（`node --check`）和「明早拆信」的日期逻辑检查。没有微信开发者工具，**不能**在模拟器里点页面，也没有连真实云环境跑 `msgSecCheck`。请用你电脑上的开发者工具预览。


## 只读 API（给用户自己的 agent 读数据）

和网页版同一套规则：用户在「设置 → API 密钥」里自己生成（每人一把，重新生成即作废旧的），集合 `api_keys` 只存 SHA-256，完整密钥只显示一次。「清空我的全部数据」会一并删掉密钥。

云函数 `api` 同时处理两种调用：

- 小程序里 `wx.cloud.callFunction({ name: 'api', data: { action: 'status' | 'create' | 'revoke' } })`，按调用者的 OPENID。
- 外部 HTTP（云开发 **HTTP 访问服务**）：`GET <域名>/api/v1/export`，请求头 `Authorization: Bearer hx_…`，可选 `since=YYYY-MM-DD`、`type=letters,todos,ideas,habits,digests`。只有 GET；密钥不对或已作废 401；每把每分钟 30 次，超了 429；返回超过 1MB 时 413，请用 since / type 分批。

开通步骤：

1. 开发者工具里对 `cloudfunctions/api` 右键 **上传并部署：云端安装依赖**（改过的 `wipe` 也要再部署一次）。
2. 云开发控制台 → 数据库 → 新建集合 `api_keys`（第一次生成密钥时函数也会自己建），权限改成「所有用户不可读写」——只让云函数读写。
3. 云开发控制台 → 环境管理（或「环境配置」）→ **HTTP 访问服务**：打开总开关 → 路由管理「新建」：域名选默认域名，触发路径 `/api/v1/export`，关联资源选「云函数」→ `api`，版本 `$DEFAULT`；**身份认证保持关闭**（鉴权由函数里的密钥负责），可以顺手设限频。保存后约 3–5 分钟生效。
4. 云函数 `api` → 函数配置 → 环境变量加 `API_URL` = `https://<默认域名>/api/v1/export`，设置页的「用法」就会显示这个地址。

默认域名（`*.app.tcloudbase.com`）官方说明只适合开发测试：有访问频率限制、有效期（到期在控制台「续期」），浏览器直接打开会先出安全提示页。长期用要绑定已备案的自定义域名。
