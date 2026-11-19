# 回信提示词

这里是日回信提示词的唯一来源。云函数部署时不能引用这个目录，所以 `scripts/sync-prompts.js` 会把同一份源文件复制到 `cloudfunctions/reply/prompt-source.js`。运行时只读那份副本。两边不一致时，`prompts/reply-source.test.js` 会失败。

改日回信的说法：编辑 `reply-source.js`，然后在 `miniprogram-app` 目录运行：

```bash
node scripts/sync-prompts.js
node --test prompts/reply-source.test.js
```

`reply-source.js` 里还有回信 JSON 的整理函数。缺精力不再收成 3，缺情绪不再收成「平静」，没写截止日期的待办不再默认 3 天。八个情绪词和 1–5 的精力数字没有增加新的取值。

## 这次没有改的

周信、季信、年信的提示词和解析仍在 `cloudfunctions/digest/index.js`。设计还在等确认，没有接到运行时。

## 文件

| 文件 | 作用 |
| --- | --- |
| `reply-source.js` | 日回信提示词、拼消息、整理 JSON |
| `fixtures.js` | 虚构日记，给自动测试拼提示词 |
| `rubric.md` | 给人看回信质量的标准。自动测试不代替这个 |
| `samples.md` | 按虚构日记写的示意回信，不是模型输出 |

自动测试只检查提示词有没有按源文件拼对、JSON 整理有没有守住原有字段。它不能证明模型真的会写成那样。
