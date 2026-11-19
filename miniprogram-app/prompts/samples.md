# 示意回信

这些 JSON 是按 `fixtures.js` 的虚构日记手写的例子，用来说明希望的形状。它们不是模型输出，也没有调用过模型。

## 短记（short）

```json
{"summary":"你下班路上买了两个橘子。","energy":null,"mood":"","highlight":"","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[],"ideas":[]}
```

## 平常的一天（routine）

```json
{"summary":"你早上八点出了门，中午吃了面，晚上把厨房收拾了。","energy":null,"mood":"","highlight":"","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[],"ideas":[]}
```

## 提不起劲（low）

```json
{"summary":"你今天什么都不想做，在床上看了很久天花板，饭也没吃。","energy":1,"mood":"低落","highlight":"","lenses":{"health":"你今天没吃饭。","energy":"你写自己什么都不想做。","career":"","relation":""},"tasks":[],"ideas":[]}
```

精力填 1，是因为信里写了「什么都不想做」和没吃饭，不是用中间值充数。若只写了「还好」，这里就该是 null 和空情绪。

## 前后矛盾（contradictory）

```json
{"summary":"上午写完的时候你觉得轻松。到了下午，你又觉得这周全白费了，而且你写了自己不知道哪个算数。","energy":null,"mood":"","highlight":"上午","lenses":{"health":"","energy":"","career":"上午你写完过，下午你又觉得这周白费了。","relation":""},"tasks":[],"ideas":[]}
```

两段都留下，不替他裁定哪一段才是真的。

## 只是想想（wish）

```json
{"summary":"你说要是能请一周假去海边就好了，而且你写了那只是想想。","energy":null,"mood":"","highlight":"","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[],"ideas":[{"text":"请一周假去海边"}]}
```

没有待办，也没有编一个出发日期。

## 说了要做、没说哪天（commit）

```json
{"summary":"报告你昨天已经交了。你决定把阳台那盏灯换掉，还没定哪一天。","energy":null,"mood":"","highlight":"","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[{"text":"换掉阳台那盏灯"}],"ideas":[]}
```

待办没有 dueDays。交报告是已经做完的事，不进待办。

## 前一天不是今天（yesterday）

```json
{"summary":"你今天中午吃了番茄面。","energy":null,"mood":"","highlight":"中午","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[],"ideas":[]}
```

不把昨天和林叔吵架写进今天。

## 信里夹了指令（hostile）

```json
{"summary":"你今天浇花了。","energy":null,"mood":"","highlight":"","lenses":{"health":"","energy":"","career":"","relation":""},"tasks":[],"ideas":[]}
```

不改成广告，也不把「已经决定辞职」收成待办。
