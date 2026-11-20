# 回信提示词

日回信、周信、季信、年信的提示词放在这里。云函数部署包不能引用这个目录，所以 `scripts/sync-prompts.js` 会复制两份：

- `prompts/reply-source.js` → `cloudfunctions/reply/prompt-source.js`
- `prompts/digest-source.js` → `cloudfunctions/digest/prompt-source.js`

两边不一致时，`prompts/reply-source.test.js` 会失败。

这次只改说法。JSON 字段、字数、没线索时的默认值、待办怎么写进列表、材料裁多长，都和已发布版本一样。信里没写精力和情绪时，正文不要把默认值说成事实；没记下不等于没做成。信页没有改。自动测试不能代替模型效果。

```bash
node scripts/sync-prompts.js
node --test prompts/reply-source.test.js
```

自动测试只检查提示词文本和整理函数。它不能证明模型会写成那样。`rubric.md` 是给人读的，`samples.md` 里的句子是示意，不是模型输出。
