# 回信小记 · 微信小程序

这是网页版「回信」的**微信小程序**，登记名称是**回信小记**。个人主体，类目「工具 - 备忘录」。它只跑在微信里，后端是**微信云开发**（云函数 + 云数据库），不需要自己的域名。

网页版（Cloudflare Workers）在仓库的 `main` 分支。两边是两本独立的本子：**不要把这个分支合并进 main**，也不要在这边改 `src/`、`public/` 那些网页文件。

本分支定位是**只有自己看得见**的每日记录：写信、待办、点子、习惯、信箱和外观。没有分享、没有广场、没有 AI 回信、周信、季信、年信。

## 和网页版的差别

| | 小程序（本分支） | 网页版（main） |
|---|---|---|
| 代码 | `miniprogram-app/` | `public/`、`src/`、`migrations/` |
| 登录 | 微信 OpenID，云函数里读取 | 账号密码 |
| 数据 | 微信云开发，境内 | Cloudflare D1 |
| 回信 | 明早拆开的是**你昨晚自己写的信** | AI 写的回信 |
| 心情 / 精力 | 寄出前自己选 | AI 打分 |
| 待办 / 点子 | 自己加，或从信里摘一句 | 可由 AI 从信里拆出 |
| 周信季信年信 | 没有。信箱「本周」只统计数字 | AI 生成 |

## 目录

| 路径 | 内容 |
|---|---|
| `miniprogram/` | 小程序前端。`config.js` 的 `ENV_ID` 为 `huixin-d1g2tdmkz68dc5a5d` |
| `miniprogram/pages/` | 今天、写信、信箱，以及信、列表、设置、隐私说明 |
| `cloudfunctions/` | `login`、`save`、`importFromWeb`、`wipe` |
| `docs/用户隐私保护指引.md` | 填到公众平台的隐私指引草稿 |
| `docs/数据库权限.json` | 六个集合的「仅创建者可读写」规则 |
| `scripts/upload.js` | 用 miniprogram-ci 上传代码并部署云函数 |
| `project.config.json` | AppID `wxb0105fcabc5187be`。`miniprogramRoot` 是 `miniprogram/`，`cloudfunctionRoot` 是 `cloudfunctions/`，用开发者工具直接打开本目录即可 |

每日一句来自网页版 `public/poems.js`，原样放在 `miniprogram/data/poems.js`。外观变量来自 `public/app.css` 的四套主题：回信红、夜信、信笺、素笺，外加跟随系统。

## 页面对照

网页版是一个单页，下面这些屏在小程序里拆开了，间距、颜色、圆角和卡片结构按原样式来。

| 网页版 | 小程序 |
|---|---|
| 今天（信封、待办、点子、旧信摘句） | `pages/today`。另外固定放「每日一句」，有习惯时显示今天的打卡 |
| 写信（纸、提示、习惯条、寄出、已寄出夜色页） | `pages/write`。寄出前自己选心情和精力。没有语音、没有 AI 整理步骤 |
| 信箱（状态曲线、按周的时间线） | `pages/mailbox`。分段是「时间线 / 本周」。本周只有写了几天、习惯完成率、完成的待办，不生成文字 |
| 拆信 / 看某一天 | `pages/letter`。封到第二天 6:00 之前，首页信封拆开才看到正文 |
| 待办与点子、完成 / 放下 | `pages/lists` |
| 待办编辑、放下原因、点子编辑 | 组件 `components/editor`，从底部盖住当前页 |
| 设置（外观、称呼、习惯、问题） | `pages/settings`。没有 AI、没有送达方式、没有账号密码 |
| （无） | `pages/privacy` 隐私说明；设置里可以导入网页版 JSON、清空全部数据 |
| 底部胶囊导航 | 自定义 tabBar：今天 / 写信 / 信箱 |

凌晨 4:00 前写的算前一天。当天 4:00 前寄出的信，封到第二天 6:00，首页显示「昨晚的你来信了」。过了 4:00 再补的信，存好就能看。

写信页可以把信里的一句点成待办（小程序文本框拿不到选区，所以改成点句子）。

## 在微信开发者工具里打开

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入项目，目录选本文件夹 `miniprogram-app`（里面有 `project.config.json`）。`miniprogramRoot` 指向 `miniprogram/`，`cloudfunctionRoot` 指向 `cloudfunctions/`，不用再改目录。
3. AppID 已写成 `wxb0105fcabc5187be`。用管理员微信登录开发者工具即可。
4. 云环境 ID 已写成 `huixin-d1g2tdmkz68dc5a5d`（`miniprogram/config.js`，四个云函数的 `cloud.init` 也是这个环境）。
5. 工具里对 `cloudfunctions` 下四个函数「上传并部署：云端安装依赖」。或用下面的上传脚本。
6. 云开发控制台新建集合（第一次写入有时会自动出现）：`letters`、`todos`、`ideas`、`habits`、`habit_logs`、`settings`。权限全部选 **仅创建者可读写**。规则原文在 `docs/数据库权限.json`。
7. 查询若提示缺索引，按开发者工具里的链接创建即可。建议字段也写在那份 JSON 里。

保存文字时，云函数 `save` 会调用 `cloud.openapi.security.msgSecCheck`（场景值 1，version 2）。判定为 risky：提示「内容包含不适合保存的信息，请修改后再存」，草稿留在输入框。review 或接口故障：仍保存，并在记录上做标记，不因为接口挡住你。

转发已关：每个页面 `wx.hideShareMenu`，没有 `onShareAppMessage`。

## 从网页版导入

网页版这个分支**没有**加导出按钮（不能改网页版文件）。在已登录的网页版里打开浏览器开发工具，请求 `GET /api/bootstrap`，把返回的 JSON 存成文件，发到微信「文件传输助手」。小程序「设置 → 选择 JSON 文件」会交给云函数 `importFromWeb`。

导入保留：信的正文、心情、精力、待办、点子、习惯和打卡、称呼、外观、自省问题。丢掉：AI 回信、周信季信年信、有用/没用、账号密码。同一天的信、同一个 id 再导一次会覆盖更新，不会复制出两份。

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

脚本使用 `miniprogram-ci`：上传代码，再对四个云函数 `uploadFunction`（云端安装依赖）。上传成功后，到公众平台 **管理 → 版本管理**，把该版本设为**体验版**。要打开的人加为体验成员（个人主体最多 15 人）。

代码上传密钥在公众平台「开发管理 → 开发设置」生成，不要提交到仓库。

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
