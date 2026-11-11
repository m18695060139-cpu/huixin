// 回信 · 示例数据（网页版 scripts/demo-data.cjs 和小程序 cloudfunctions/demoSeed/data.js 是同一个文件，改一边就复制到另一边）
// 一个人五六周的信：从「开会的间隙做设计」到决定换一份工作，旁边是跑步、早睡和画楼下的小店。
// 日期全部相对「今天」（北京时间）现算：按周排，最后一封永远是昨晚的，回信封好等你拆。
// 只生成数据，不写库。网页版 scripts/demo-reset.mjs 把它转成 SQL；小程序云函数 demoSeed 标上 demo:true 写进调用者自己的库。

// wk：第几周以前（1 = 上一个整周，5 = 最早那周）；dow：周几（1 周一 … 7 周日）
// hb：这天打了卡的习惯；todos / ideas：从这封信里整理出来的（见下面 TODOS / IDEAS 的 src）
const LETTERS = {
  w5wed: { wk: 5, dow: 3, energy: 2, mood: '疲惫', hl: '',
    text: '第一次试着给明天的自己写信。今天开了五个会，真正打开设计稿的时间加起来不到一个小时。下班路上一直在想，我到底是在做设计，还是在开会的间隙做设计。\n\n晚上又刷手机到十二点半，躺下的时候眼睛是酸的。先写到这里，明天见。',
    reply: '这是你写来的第一封信。\n\n五个会，真正打开设计稿的时间加起来不到一个小时。下班路上你问自己：到底是在做设计，还是在开会的间隙做设计。这句话你写得很清楚，像是在心里放了一阵子了。\n\n晚上又刷手机到十二点半，躺下时眼睛是酸的。今天的精力几乎都给了会议，整个人是累的。',
    lenses: { health: '刷手机到十二点半，眼睛发酸。', energy: '五个会把一天的精力耗光了。', career: '真正画图的时间不到一小时。', relation: '' } },
  w5thu: { wk: 5, dow: 4, energy: 3, mood: '平静', hl: '晚上', hb: ['run'],
    text: '下班后去河边跑了两公里，半年来第一次。跑到一半就喘得不行，走了一段又接着跑。鞋底已经磨平了，得换一双。\n\n今天会少一点，下午画了两个小时的会员页，总算有点进展。',
    reply: '下班后你去河边跑了两公里，这是半年来的第一次。跑到一半喘得不行，走一段又接着跑。鞋底磨平了，你说得换一双。\n\n今天会比昨天少，下午你画了两个小时的会员页，总算有了进展。昨天信里不到一小时的画图时间，今天翻了一倍。\n\n身体是累的，心里比昨天松，精力最好的是晚上。',
    lenses: { health: '半年来第一次跑步，跑了两公里。', energy: '会少了，下午能专心画图。', career: '会员页画了两个小时，有进展。', relation: '' } },
  w5fri: { wk: 5, dow: 5, energy: 3, mood: '感激', hl: '晚上',
    text: '下午评审，会员页的方案被说「不够有记忆点」，当场有点下不来台。\n\n晚上和小满吃火锅，跟她吐槽了半天。她翻我手机相册，看到我随手画的楼下几家小店，说这些可以画成一张街区地图。吃完走回家，心情好了很多。',
    reply: '下午评审，会员页的方案被说「不够有记忆点」，你说当场有点下不来台。\n\n晚上和小满吃火锅，你跟她吐槽了半天。她翻到你随手画的楼下几家小店，说可以画成一张街区地图。吃完走回家，你说心情好了很多。\n\n一天从下午的低谷，被晚上的一顿饭接住了，整体是被温暖到的。',
    lenses: { health: '', energy: '评审被打回，拖低了下午。', career: '方案被说「不够有记忆点」。', relation: '和小满吃火锅，聊得很开心。' } },
  w5sat: { wk: 5, dow: 6, energy: 3, mood: '平静', hl: '下午', hb: ['draw'],
    text: '睡到十一点，起来头有点昏。下午去河边走了一圈，回来坐在窗边把楼下面包店的门脸画完了，画了快两个小时，一点都没觉得久。\n\n想把这张画送给面包店的老板娘。妈妈打电话说下周降温，让我把厚被子拿出来。',
    reply: '睡到十一点，起来头有点昏。下午你去河边走了一圈，回来坐在窗边，把楼下面包店的门脸画完了。快两个小时，你说一点都没觉得久，还想把这张画送给老板娘。\n\n妈妈打电话提醒下周降温，让你把厚被子拿出来。\n\n这是你写的第四封信，也是第一封没有提到会议的。精力最好的是下午，人是安静的。',
    lenses: { health: '睡到十一点，起来头昏。', energy: '画了两小时，一点不觉得累。', career: '', relation: '妈妈打电话提醒降温。' } },

  w4mon: { wk: 4, dow: 1, energy: 2, mood: '烦躁', hl: '晚上', hb: ['read'],
    text: '周一又是从早会排到晚会。我发现一个规律：会开得多的那天，晚上就特别停不下来刷手机，好像要把白天被拿走的时间抢回来。\n\n明天开始把周会议程提前一天发出去，至少让大家带着结论来。也许可以整理一份「少开会」的小方法，分享给组里。睡前读了二十页书，没碰手机。',
    reply: '周一又是从早会排到晚会。你发现了一个规律：会开得多的那天，晚上就停不下来刷手机，像是要把白天被拿走的时间抢回来。\n\n上周三的第一封信里，也是五个会之后刷手机到十二点半，今天你自己把这两件事连在了一起。你决定把周会议程提前一天发出去，让大家带着结论来；睡前读了二十页书，没碰手机。\n\n白天被会议推着走，有点烦躁，晚上你把时间拿回来了一点。',
    lenses: { health: '睡前没碰手机，读了二十页书。', energy: '会多的日子，晚上更想刷手机。', career: '想让大家带着结论来开会。', relation: '' } },
  w4tue: { wk: 4, dow: 2, energy: 4, mood: '专注', hl: '晚上', hb: ['run', 'sleep'],
    text: '议程昨晚发出去了，今天的周会只开了四十分钟，比平时少了二十分钟。老周说以后都这样。\n\n晚上跑了三公里，比上周多了一公里，中间没停。十二点前关灯，好久没这么早睡了。',
    reply: '昨晚发出去的议程起了作用：周会只开了四十分钟，比平时少二十分钟，老周说以后都这样。\n\n晚上你跑了三公里，比上周多一公里，中间没停。十二点前关了灯，你说好久没这么早睡了。\n\n从会议里拿回了一点时间，身体也跟上了。这是你写信以来精力最好的一天，在晚上。',
    lenses: { health: '跑了三公里没停，十二点前睡。', energy: '会议缩短后，明显轻松。', career: '周会从一小时缩到四十分钟。', relation: '' } },
  w4thu: { wk: 4, dow: 4, energy: 4, mood: '振奋', hl: '中午', hb: ['sleep'],
    text: '中午收到阿杰的消息。他去年离职去了一家小工作室，八个人，做给独立书店用的工具。他说他们在招设计师，问我有没有兴趣聊聊。\n\n我盯着那条消息看了很久，心跳有点快。我挺喜欢现在的组，但也确实很久没有那种「这个东西是我做的」的感觉了。先回他约个时间吧，聊聊又不吃亏。',
    reply: '中午阿杰发来消息：他去年去了一家八个人的小工作室，做给独立书店用的工具，现在在招设计师，问你有没有兴趣聊聊。\n\n你盯着那条消息看了很久，心跳有点快。你写了喜欢现在的组，也写下了另一半：很久没有「这个东西是我做的」的感觉了。最后你给自己的话是：聊聊又不吃亏。\n\n这一天的高光在中午，人是被点亮的。',
    lenses: { health: '', energy: '收到消息后心跳加快，很兴奋。', career: '很久没有「这是我做的」的感觉。', relation: '阿杰主动来问你，你想聊聊。' } },
  w4fri: { wk: 4, dow: 5, energy: 2, mood: '疲惫', hl: '', hb: ['sleep'],
    text: '会员改版下周四上线，今天被排了三个临时需求，加班到九点半。回了阿杰，约了下周二下午喝咖啡。\n\n回家路上有点恍惚，一边是马上要上线的东西，一边是一个完全不知道会怎样的机会。',
    reply: '会员改版下周四上线，今天又被排了三个临时需求，你加班到九点半。阿杰那边回了，约在下周二下午喝咖啡。\n\n回家路上你有点恍惚：一边是马上要上线的东西，一边是一个完全不知道会怎样的机会。两件事你都写下来了，没有急着替自己选。\n\n临时需求把精力压得很低，人是累的。',
    lenses: { health: '加班到九点半。', energy: '三个临时需求压低了精力。', career: '改版下周四上线，又来了新机会。', relation: '和阿杰约好下周二见面。' } },
  w4sat: { wk: 4, dow: 6, energy: 4, mood: '平静', hl: '上午', hb: ['run', 'draw', 'sleep'],
    text: '早上换上新买的跑鞋，跑了三公里，脚步轻了很多。下午去巷口画修鞋铺，老伯一边补鞋一边跟我聊，说他在这里摆了二十六年。他问我画好了能不能给他看看。\n\n冒出一个念头：给老伯画一张新招牌，他那块牌子的字都掉了一半了。',
    reply: '早上你换上新跑鞋跑了三公里，脚步轻了很多。上周你写过鞋底磨平了，这件事今天了结了。\n\n下午你去巷口画修鞋铺。老伯一边补鞋一边说，他在这里摆了二十六年，还问画好了能不能给他看看。你想给他画一张新招牌，因为那块牌子的字掉了一半。\n\n这是会员改版上线前的最后一个周末，你过得很慢，也很满，精力最好的是上午。',
    lenses: { health: '换了新跑鞋，跑了三公里。', energy: '慢下来的周末，状态很好。', career: '', relation: '和修鞋铺老伯聊了很久。' } },
  w4sun: { wk: 4, dow: 7, energy: 3, mood: '感激', hl: '晚上', hb: ['read', 'sleep'],
    text: '和妈妈视频，教她用手机拍月亮，她拍了十几张，每张都糊，但她特别高兴，说要发给小姨看。\n\n把面包店那张画送给了老板娘，她说要贴在收银台旁边，还塞给我两个可颂。这个周末好像什么正事都没做，但很开心。',
    reply: '和妈妈视频，你教她用手机拍月亮。她拍了十几张，每张都糊，但特别高兴，说要发给小姨看。\n\n面包店那张画送给了老板娘，她要贴在收银台旁边，还塞给你两个可颂。你说这个周末什么正事都没做，但很开心。\n\n这一周从烦躁的周一开始，落在了今晚的感激上，晚上最好。',
    lenses: { health: '', energy: '没做正事的周末，人很松。', career: '', relation: '教妈妈拍月亮，画送给了面包店。' } },

  w3mon: { wk: 3, dow: 1, energy: 2, mood: '焦虑', hl: '',
    text: '上线倒计时，从早上九点改到晚上十点半。连着六天十二点前睡的记录，今天断了。\n\n本来想每天早上六点起来画半小时，现在看根本不可能，先放下吧，改成周末画。',
    reply: '上线倒计时，你从早上九点改到了晚上十点半。连着六天十二点前睡的记录，今天断了。\n\n你把「每天早上六点起来画半小时」放下了，备注里写的是「上线这周根本起不来」，周末还是留给画画。\n\n这一天几乎都给了上线，精力很低，人是绷着的。',
    lenses: { health: '连续六天的早睡今天断了。', energy: '从九点改到十点半，绷得很紧。', career: '会员改版进入上线倒计时。', relation: '' } },
  w3tue: { wk: 3, dow: 2, energy: 3, mood: '振奋', hl: '下午',
    text: '下午溜出去一个小时，和阿杰在工作室楼下喝咖啡。他们给书店做借阅和会员的小工具，一个设计师要从头管到尾。工资比现在少一点，但他说「你做的每个按钮，第二天书店老板就会用到」。\n\n回来接着改到十点。我说回去想想，其实一路上都在想。',
    reply: '下午你溜出去一个小时，和阿杰在工作室楼下喝了咖啡。他们给书店做借阅和会员的小工具，一个设计师从头管到尾，工资比现在少一点。他说：「你做的每个按钮，第二天书店老板就会用到。」\n\n上周四你写过，很久没有「这个东西是我做的」的感觉了。阿杰这句话，正好落在那里。\n\n你跟他说回去想想，回来接着改到十点，一路上都在想。今天的精神在下午。',
    lenses: { health: '又改到了晚上十点。', energy: '上线压力下，下午的咖啡很提神。', career: '工作室：从头管到尾，工资略少。', relation: '和阿杰聊了一个小时。' } },
  w3wed: { wk: 3, dow: 3, energy: 1, mood: '焦虑', hl: '',
    text: '上线前夜，改到凌晨一点，发现一个支付页的问题，又和开发对了一个小时。好累。不想写了。',
    reply: '上线前夜，你改到凌晨一点，发现支付页的一个问题，又和开发对了一个小时。\n\n你说好累，不想写了，但还是把这几行写完了。\n\n这是你写信以来精力最低的一天。',
    lenses: { health: '改到凌晨一点。', energy: '精力见底。', career: '上线前发现支付页的问题。', relation: '' } },
  w3thu: { wk: 3, dow: 4, energy: 3, mood: '平静', hl: '下午', hb: ['sleep'],
    text: '上线了。下午看数据，会员页的点击比旧版高了一点，老周在群里说了一句「辛苦了」。\n\n整个人像被抽空，又说不出的轻松。晚上什么也没干，十一点就睡了。',
    reply: '会员改版上线了。下午看数据，点击比旧版高了一点，老周在群里说了句「辛苦了」。\n\n昨晚你写「好累，不想写了」，今天你写的是：像被抽空，又说不出的轻松。晚上什么也没干，十一点就睡了，这是早睡断掉三天以后的第一次。\n\n压着的事落了地，今天是平静的，下午最好。',
    lenses: { health: '十一点就睡了。', energy: '被抽空，但轻松。', career: '改版上线，点击比旧版高。', relation: '老周说了句「辛苦了」。' } },
  w3sat: { wk: 3, dow: 6, energy: 4, mood: '振奋', hl: '上午', hb: ['run'],
    text: '睡了十个小时。上午跑了四公里，最长的一次。\n\n下午去河边市集逛了一圈，看到有人摆摊卖自己画的明信片，生意还挺好。我突然想，我画的那几家小店，是不是也可以做成明信片？还想过开个账号每天发一张，又觉得每天太勉强。',
    reply: '睡了十个小时，上午你跑了四公里，是最长的一次。\n\n下午在河边市集，你看到有人摆摊卖自己画的明信片，生意不错。你想到自己画的那几家小店，也许可以做成明信片；想过开个账号每天发一张，又觉得每天太勉强。\n\n上线后的第一个周末，精力回来了，最好的是上午。',
    lenses: { health: '睡了十小时，跑了四公里。', energy: '上线后，精力回来了。', career: '', relation: '' } },
  w3sun: { wk: 3, dow: 7, energy: 3, mood: '平静', hl: '晚上', hb: ['read', 'sleep'],
    text: '拿了张纸，把留下和去工作室各自的好处坏处列了出来。留下：稳定、组里的人好、明年可能升职。去：每个东西都是自己做的、离书近、工资少一点、不知道能不能做好。\n\n写着写着发现，写「去」的那一栏，我的字越写越大。',
    reply: '你拿了张纸，把留下和去工作室各自的好处坏处列了出来。留下：稳定、组里的人好、明年可能升职。去：每个东西都是自己做的、离书近、工资少一点、不知道能不能做好。\n\n你还发现了一件小事：写「去」的那一栏，字越写越大。\n\n这周从上线前夜的凌晨一点，走到了今晚这张纸。人是平静的，晚上最好。',
    lenses: { health: '', energy: '平静地想清楚一些事。', career: '列出了留下和离开的好处坏处。', relation: '' } },

  w2mon: { wk: 2, dow: 1, energy: 3, mood: '专注', hl: '晚上', hb: ['sleep'],
    text: '跟阿杰说了想继续聊，他约我周三和工作室的创始人见一面，让我先把作品集发过去。\n\n晚上翻了这几年的稿子，想放的东西太多，又觉得哪个都不够好。先挑六个吧。',
    reply: '你跟阿杰说想继续聊。他约了周三和工作室的创始人见面，让你先把作品集发过去。\n\n晚上你翻了这几年的稿子：想放的太多，又觉得哪个都不够好。最后你给自己定了个数，先挑六个。\n\n昨晚列完那张纸，今天你往前走了一步。人是专注的，晚上最好。',
    lenses: { health: '', energy: '晚上专注地翻稿子。', career: '准备作品集，周三见创始人。', relation: '阿杰帮你约了创始人。' } },
  w2tue: { wk: 2, dow: 2, energy: 3, mood: '平静', hl: '晚上', hb: ['run', 'read', 'sleep'],
    text: '作品集发出去了。挑了六个项目，删掉了一半想放的，删的时候有点心疼。\n\n晚上跑了三公里，回来读了半小时书。又连着三天十二点前睡了。',
    reply: '作品集发出去了。六个项目，删掉了一半想放的，你说删的时候有点心疼。\n\n晚上跑了三公里，回来读了半小时书，又连着三天十二点前睡了。上线那周断掉的早睡，你一点点接了回来。\n\n是平静、规律的一天，晚上最好。',
    lenses: { health: '跑步、读书，连续三天早睡。', energy: '规律的一天，很稳。', career: '作品集发给了工作室。', relation: '' } },
  w2wed: { wk: 2, dow: 3, energy: 4, mood: '振奋', hl: '下午', hb: ['sleep'],
    text: '下午见了工作室的创始人，一个说话很慢的姐姐。她没怎么看作品集，一直在问我为什么做设计。最后给了我一个小题目：设计一张书店的借阅卡和借书流程，下周一前交。\n\n出门的时候脚步是飘的。回来路上就开始想借阅卡上该印什么了。',
    reply: '下午你见了工作室的创始人，你写她是一个说话很慢的姐姐。她没怎么看作品集，一直在问你为什么做设计，最后给了个小题目：设计一张书店的借阅卡和借书流程，下周一前交。\n\n出门时你说脚步是飘的，回来的路上已经在想借阅卡上该印什么了。从收到阿杰的消息算起，这是你第一次动手做那边的东西。\n\n这一天很振奋，下午最好。',
    lenses: { health: '', energy: '见完创始人，整个人很兴奋。', career: '拿到小题目：书店借阅卡和流程。', relation: '和创始人聊为什么做设计。' } },
  w2fri: { wk: 2, dow: 5, energy: 4, mood: '振奋', hl: '晚上', hb: ['run', 'sleep'],
    text: '借阅卡画了三版，最后交的是最简单的那版，只有书名、日期和一个还书的小印章。交完去跑步，第一次跑满了五公里。\n\n跑到最后一公里的时候，脑子里一直在放第一封信里那句话：我到底是在做设计，还是在开会的间隙做设计。',
    reply: '借阅卡你画了三版，最后交的是最简单的那版：只有书名、日期和一个还书的小印章。交完你去跑步，第一次跑满了五公里。\n\n从跑到一半就喘的两公里，到今天的五公里，中间隔着不到一个月。最后一公里，你脑子里放的是第一封信里那句话：到底是在做设计，还是在开会的间隙做设计。\n\n这一天是振奋的，晚上最好。',
    lenses: { health: '第一次跑满五公里。', energy: '交完题目，晚上状态最好。', career: '交了借阅卡，选了最简单的那版。', relation: '' } },
  w2sat: { wk: 2, dow: 6, energy: 3, mood: '平静', hl: '下午', hb: ['draw', 'read'],
    text: '下午去街角的花店画画，老板在修剪一大桶洋桔梗，满屋子都是叶子的味道。画完给她看，她说她的店从来没有被人画过。\n\n晚上读完了一本讲小店的书，书里说开店最难的是第三年。想学做手工书，把这些画装订成一本小册子。',
    reply: '下午你去街角的花店画画。老板在修剪一大桶洋桔梗，你写满屋子都是叶子的味道。画完给她看，她说她的店从来没被人画过。\n\n晚上你读完了一本讲小店的书，记下了一句：开店最难的是第三年。\n\n面包店、修鞋铺，现在是花店。安静的一天，下午最好。',
    lenses: { health: '', energy: '安静地画画、读书。', career: '', relation: '花店老板说从没被人画过。' } },
  w2sun: { wk: 2, dow: 7, energy: 4, mood: '感激', hl: '晚上', hb: ['sleep'],
    text: '小满来家里吃饭，我做了番茄牛腩。她把我画的小店一张一张摆在桌上，说凑够五家就能拼成一张地图了，还说可以去河边市集摆个摊。\n\n她借我的那本书我还没看完，答应下周还她。',
    reply: '小满来家里吃饭，你做了番茄牛腩。她把你画的小店一张一张摆在桌上，说凑够五家就能拼成一张地图，还说可以去河边市集摆个摊。\n\n街区地图是你第一周和她吃火锅时冒出来的点子，现在你已经画了三家店。\n\n她借你的那本书还没看完，你答应下周还她。这是被朋友托住的一天，晚上最好。',
    lenses: { health: '', energy: '和朋友吃饭，很放松。', career: '', relation: '小满来家里吃饭，帮你出主意。' } },

  w1mon: { wk: 1, dow: 1, energy: 4, mood: '振奋', hl: '上午',
    text: '上午收到了工作室的 offer。创始人说借阅卡那版简单得刚刚好。工资比现在少一些，但比我想的多一点。\n\n高兴了十分钟，然后开始害怕：万一去了做不好呢？万一小工作室撑不下去呢？晚上把会员改版的数据复盘写了一半，老周要的，我得先把手上的事做完。',
    reply: '上午你收到了工作室的 offer。创始人说借阅卡那版简单得刚刚好；工资比现在少一些，但比你想的多一点。\n\n你写自己高兴了十分钟，然后开始害怕：万一去了做不好，万一小工作室撑不下去。晚上你还是把老周要的会员改版复盘写了一半，你说得先把手上的事做完。\n\n高兴和害怕你都写下来了。这一天的高光在上午。',
    lenses: { health: '', energy: '高兴之后是害怕。', career: '拿到 offer，复盘写了一半。', relation: '' } },
  w1tue: { wk: 1, dow: 2, energy: 3, mood: '感激', hl: '晚上', hb: ['read', 'sleep'],
    text: '给妈妈打电话说了 offer 的事。我以为她会劝我别折腾，她想了一会儿说：「你自己想好就行，钱少点没关系，别老熬夜。」\n\n挂了电话，我坐在阳台上发了很久的呆。想每个月给她寄一张自己画的明信片。',
    reply: '你给妈妈打电话说了 offer 的事。你以为她会劝你别折腾，她想了一会儿说：「你自己想好就行，钱少点没关系，别老熬夜。」\n\n挂了电话，你在阳台上发了很久的呆，想到每个月给她寄一张自己画的明信片。\n\n昨天的信里写的是害怕，今天的信里没有再提。人是安静的，晚上最好。',
    lenses: { health: '', energy: '电话之后，很安静。', career: '', relation: '妈妈说「你自己想好就行」。' } },
  w1wed: { wk: 1, dow: 3, energy: 4, mood: '平静', hl: '早上', hb: ['sleep'],
    text: '早上把第一封信翻出来又读了一遍。「我到底是在做设计，还是在开会的间隙做设计。」四周前写的，读的时候还是有点鼻子发酸。\n\n决定了，去。中午回复了工作室，入职日期等和老周谈完再定。说出口以后，反而一点都不慌了。',
    reply: '早上你把第一封信翻出来又读了一遍。「我到底是在做设计，还是在开会的间隙做设计。」四周前写下的这句话，你说读的时候鼻子还是有点发酸。\n\n你决定了：去。中午回复了工作室，入职日期等和老周谈完再定。说出口以后，你反而一点都不慌了。\n\n收到阿杰的消息、楼下那杯咖啡、那张好处坏处的纸、三版借阅卡，这些信一封一封都在。今天是平静的，最好的是早上。',
    lenses: { health: '', energy: '做了决定以后，不再慌了。', career: '决定接受工作室的 offer。', relation: '' } },
  w1fri: { wk: 1, dow: 5, energy: 3, mood: '焦虑', hl: '晚上', hb: ['run', 'sleep'],
    text: '想了一整天怎么跟老周开口。他带了我三年，给过我很多机会，越想越说不出口。约了他下周找时间聊。\n\n晚上跑了五公里，跑完把要说的话在脑子里过了三遍。第一句想好了：「老周，有件事我想先跟你说。」',
    reply: '你想了一整天怎么跟老周开口。他带了你三年，给过你很多机会，你说越想越说不出口，最后约了他下周找时间聊。\n\n晚上跑了五公里，跑完你把要说的话在脑子里过了三遍，第一句已经想好了：「老周，有件事我想先跟你说。」\n\n心里有点紧，身体是稳的，晚上最好。',
    lenses: { health: '跑了五公里。', energy: '一天都悬着，跑完稳下来。', career: '准备和老周谈离职。', relation: '老周带了你三年，难开口。' } },
  w1sat: { wk: 1, dow: 6, energy: 4, mood: '平静', hl: '下午', hb: ['draw', 'read', 'sleep'],
    text: '下午画了第四家：巷尾的旧书店。老板听说我要去做书店的工具，非要送我一本旧画册，还说「以后你做的东西，我第一个用」。\n\n回来把四家店并排贴在墙上，面包店那张是照着照片重画的。还差一家，地图就齐了。想在地图背面给每家店写一句话。',
    reply: '下午你画了第四家：巷尾的旧书店。老板听说你要去做书店的工具，非要送你一本旧画册，说：「以后你做的东西，我第一个用。」\n\n你把四家店并排贴在墙上：面包店（照着照片重画的）、修鞋铺、花店、旧书店。还差一家，地图就齐了。你还想在地图背面给每家店写一句话。\n\n这周的信从 offer、电话、决定，走到了一个安静的周六。下午最好。',
    lenses: { health: '', energy: '安静的周六下午。', career: '旧书店老板说会第一个用。', relation: '旧书店老板送了你一本画册。' } },
};

// 这周（周一到前天）的信：按顺序放，第三天空着；都是工作日也读得通的内容
const POOL = [
  { energy: 3, mood: '专注', hl: '上午', hb: ['read', 'sleep'],
    text: '会员改版的复盘做完了大半，就差转化那部分的图。组里还不知道我要走，大家照常讨论下个季度的需求，我坐在那儿有点不是滋味。\n\n晚上翻了几页旧书店老板送的画册。',
    reply: '会员改版的复盘做完了大半，就差转化那部分的图。组里还不知道你要走，大家照常讨论下个季度的需求，你说坐在那儿有点不是滋味。\n\n晚上你翻了几页旧书店老板送的画册。\n\n手上的事还在往前推，心里有一点复杂。精力最好的是上午。',
    lenses: { health: '', energy: '上午专注，开会时心里复杂。', career: '复盘只差转化那部分的图。', relation: '组里还不知道你要走。' } },
  { energy: 2, mood: '疲惫', hl: '', hb: ['sleep'],
    text: '今天的会又排满了，五个。下班的时候发现自己没有那么烦了，大概是知道这样的日子不多了。\n\n晚上没跑步，也没画画，早点睡。',
    reply: '今天的会又排满了，五个，和你第一封信里那天一样多。不同的是，下班时你发现自己没那么烦了，你说大概是知道这样的日子不多了。\n\n晚上没跑步，也没画画，你说早点睡。\n\n会议还是把精力吃掉了，人是累的，但不烦。',
    lenses: { health: '没运动，早点睡。', energy: '五个会，精力偏低。', career: '会议还是排满了。', relation: '' } },
  { energy: 3, mood: '平静', hl: '晚上', hb: ['read', 'sleep'],
    text: '下雨，没去河边，在楼道里爬了二十层楼梯当跑步。早早洗完澡，十一点就躺下了。\n\n睡前列了一下交接要写的东西：会员页的设计规范、三个还没做完的需求、组件库的说明。比想象中多。',
    reply: '下雨没去河边，你在楼道里爬了二十层楼梯当跑步，早早洗完澡，十一点就躺下了。\n\n睡前你列了交接要写的东西：会员页的设计规范、三个还没做完的需求、组件库的说明，你说比想象中多。\n\n雨天也没让节奏断掉，人是平静的，晚上最好。',
    lenses: { health: '爬了二十层楼梯，十一点躺下。', energy: '节奏很稳。', career: '列出了交接要写的东西。', relation: '' } },
  { energy: 4, mood: '振奋', hl: '中午', hb: ['sleep'],
    text: '中午阿杰发来工作室的照片：一张很大的木桌，窗外是一排梧桐，桌上摆着几本书店寄来的样书。他说我的位置靠窗。\n\n小满问我月底那个周末要不要一起去市集摆摊，她出桌子，我出明信片。我说好。',
    reply: '中午阿杰发来工作室的照片：一张很大的木桌，窗外是一排梧桐，桌上摆着书店寄来的样书。他说你的位置靠窗。\n\n小满问你月底那个周末要不要一起去市集摆摊，她出桌子，你出明信片。你说好。\n\n去市集摆摊，是你记在点子库里的事，现在有了日子。这一天的高光在中午。',
    lenses: { health: '', energy: '看到新工位的照片，很期待。', career: '新工作室的位置靠窗。', relation: '小满约你月底一起摆摊。' } },
];

// 昨晚的信：永远放在昨天，回信封好等你早上拆
const LAST = { energy: 4, mood: '平静', hl: '晚上', hb: ['run', 'sleep'],
  text: '今天和老周打了四十分钟电话，把要走的事说了。他沉默了一会儿，问是不是因为最近加班太多。我说不全是，是想试试自己从头做一个东西。他说：「那你去，做不好就回来喝茶。」说好月底前交接完。\n\n挂了电话去河边跑了五公里，回来写这封信，手终于不抖了。\n\n明天要把交接清单写出来，再给阿杰回个话，把入职日期定下来。也得跟妈妈说一声，谈完了。还想给新同事画一张自我介绍卡，画我自己和楼下那几家小店。',
  reply: '今天你和老周打了四十分钟电话，把要走的事说了。他沉默了一会儿，问是不是因为最近加班太多。你说不全是，是想试试自己从头做一个东西。他说：「那你去，做不好就回来喝茶。」你们说好月底前交接完。\n\n周五那天你跑完五公里，把第一句话在脑子里过了三遍；今天话说出口了，你又去河边跑了五公里，回来写信时手终于不抖了。明天的事你也列好了：写交接清单，给阿杰回话定入职日期，跟妈妈说一声谈完了。你还想给新同事画一张自我介绍卡，画你自己和楼下那几家小店。\n\n一个多月前的第一封信里，你问自己是在做设计，还是在开会的间隙做设计。今晚这封信里，你已经在想下一张画了。一天从紧到松，精力不错，晚上最好。',
  lenses: { health: '跑了五公里，回来手不抖了。', energy: '一天从紧到松。', career: '和老周谈完，月底前交接。', relation: '老周说「做不好就回来喝茶」。' } };

// 待办。src：从哪封信来（没有就是自己加的）；due / done / dropped：
//   { t: n } 相对今天；{ s: n } 相对来源那封信；{ at: 'w1sat', n } 相对某一封信的日子
const TODOS = [
  // 昨晚的信里拆出来的：拆信之前不出现
  { text: '写交接清单', src: 'last', due: { t: 0 } },
  { text: '给阿杰回话，定下入职日期', src: 'last', due: { t: 0 } },
  { text: '跟妈妈说一声，和老周谈完了', src: 'last', due: { t: 1 } },
  // 还没做的
  { text: '把会员改版的数据复盘发给老周', src: 'w1mon', due: { t: -2 }, note: '做完了大半，就差转化那部分的图' },
  { text: '把书还给小满', src: 'w2sun', due: { t: -4 } },
  { text: '去打印店问明信片的价格', src: 'w3sat', fromIdea: 'postcard', created: { at: 'w1sat' }, due: { t: 3 }, note: '先印五家店的，每种二十张' },
  { text: '先画五家店，凑成街区地图的第一版', src: 'w5fri', fromIdea: 'map', created: { at: 'w2sun' }, due: { t: 5 }, note: '面包店、修鞋铺、花店、旧书店都画好了，还差一家' },
  { text: '报名月底的十公里路跑', created: { at: 'w1fri' }, due: { t: 6 } },
  { text: '备份这几年的设计稿', created: { at: 'w1sat' }, due: { t: 9 } },
  // 做完的（有几条写了做完时的备注）
  { text: '买一双新跑鞋', src: 'w5thu', due: { s: 3 }, done: { at: 'w4fri' }, note: '旧的那双鞋底磨平了，新鞋跑起来轻很多' },
  { text: '把厚被子拿出来', src: 'w5sat', due: { s: 2 }, done: { s: 1 } },
  { text: '把周会议程提前一天发出去', src: 'w4mon', due: { s: 1 }, done: { s: 1 }, note: '周会少开了二十分钟，老周说以后都这样' },
  { text: '回阿杰的消息，约时间聊聊', src: 'w4thu', due: { s: 2 }, done: { s: 1 }, note: '约了下周二下午喝咖啡' },
  { text: '把面包店那张画送给老板娘', src: 'w5sat', fromIdea: 'bakery', created: { at: 'w4sat' }, due: { s: 3 }, done: { at: 'w4sun' }, note: '她说要贴在收银台旁边，还塞给我两个可颂' },
  { text: '把修鞋铺的画拿给老伯看', src: 'w4sat', due: { s: 7 }, done: { at: 'w3sat' }, note: '老伯戴上老花镜看了半天，说比照片还像' },
  { text: '会员改版上线', src: 'w3mon', due: { s: 3 }, done: { s: 3 }, note: '点击比旧版高了一点，老周在群里说了句辛苦了' },
  { text: '整理作品集，发给工作室', src: 'w2mon', due: { s: 1 }, done: { s: 1 }, note: '挑了六个项目，删掉了一半想放的' },
  { text: '交书店借阅卡的小题目', src: 'w2wed', due: { s: 5 }, done: { s: 2 }, note: '画了三版，交了最简单的那版' },
  { text: '回复工作室的 offer', src: 'w1mon', due: { s: 3 }, done: { s: 2 }, note: '回复了接受，入职日期等和老周谈完再定' },
  { text: '找老周谈一次', src: 'w1wed', due: { s: 5 }, done: { t: -1 }, note: '打了四十分钟电话，说好月底前交接完' },
  // 放下的：带着原因
  { text: '每天早上六点起来画半小时', created: { at: 'w4sun' }, due: { at: 'w3mon' }, dropped: { at: 'w3mon' }, note: '上线这周根本起不来，先改成周末画' },
  { text: '周末去隔壁城市看插画展', created: { at: 'w3thu' }, due: { at: 'w2sat' }, dropped: { at: 'w2fri' }, note: '票没抢到，那天换成去花店画画了' },
  { text: '报名今年的设计大赛', created: { at: 'w4tue' }, due: { at: 'w2sun' }, dropped: { at: 'w2wed' }, note: '时间都给了面试，今年先不参加' },
];

// 点子。status：open 还在点子库 / todo 已转成待办 / dropped 放下了（at：放下的那天）
const IDEAS = [
  { text: '给新同事画一张自我介绍卡', src: 'last' },
  { text: '在地图背面给每家店写一句话', src: 'w1sat' },
  { text: '每个月给妈妈寄一张自己画的明信片', src: 'w1tue' },
  { text: '去河边市集摆摊卖明信片', src: 'w2sun' },
  { text: '给修鞋铺老伯画一张新招牌', src: 'w4sat' },
  { text: '整理一份「少开会」的小方法，分享给组里', src: 'w4mon' },
  { key: 'map', text: '把楼下的小店画成一张街区地图', src: 'w5fri', status: 'todo', at: 'w2sun' },
  { key: 'postcard', text: '把画的小店做成一套明信片', src: 'w3sat', status: 'todo', at: 'w1sat' },
  { key: 'bakery', text: '把面包店那张画送给老板娘', src: 'w5sat', status: 'todo', at: 'w4sat' },
  { text: '开个账号，每天发一张小店的画', src: 'w3sat', status: 'dropped', at: 'w2tue' },
  { text: '学做手工书，把画装订成一本小册子', src: 'w2sat', status: 'dropped', at: 'w1sat' },
];

// 没写信的那几天也打了卡的（at：相对哪封信的日子，n：往后几天）
const EXTRA_LOGS = [
  { at: 'w4tue', n: 1, hb: 'sleep' },
  { at: 'w2wed', n: 1, hb: 'sleep' },
  { at: 'w1wed', n: 1, hb: 'sleep' },
  { at: 'w1mon', n: 0, hb: 'sleep' },
];

// 习惯
const HABITS = [['sleep', '早睡'], ['run', '跑步'], ['read', '读书'], ['draw', '画画']];

const NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
const num = n => (n >= 0 && n <= 10 ? NUM[n] : String(n));

// 周信 / 季信 / 年信：正文里的数字（几封信、几天）按实际铺出来的数据现算
const WEEKS = {
  5: s => ({
    title: '会议之外，你画了一家店',
    letter: `这周的信不多，只有${num(s.letters)}封，还看不出趋势。\n\n能看到的是：第一封信里，五个会把画图的时间挤到了不到一小时；第二天你跑了半年来的第一次步；周五方案被说「不够有记忆点」，晚上和小满吃火锅，冒出了画一张街区地图的点子；周六你坐在窗边，把楼下面包店画了两个小时。\n\n精力最低的那天，是会开得最多的那天；好的时候都在会议之外。`,
    energy_note: '会议多的日子精力低，跑步和画画的时候最好。',
    forgotten: [],
    next: '试着让会少一点，把画图的时间拿回来。',
    lenses: { health: '跑了一次两公里，有两晚睡得晚。', energy: '会议是最大的消耗。', career: '会员页方案被打回。', relation: '小满陪你吃火锅，妈妈提醒降温。' },
  }),
  4: s => ({
    title: '周会短了二十分钟',
    letter: `这周你写了${num(s.letters)}封信。周一你发现了一个规律：会开得多的那天，晚上就停不下手机。第二天你把周会议程提前发了出去，会少开了二十分钟，那天晚上跑了三公里，十二点前就睡了。\n\n周四阿杰发来消息，问你想不想去他那家八个人的工作室聊聊。你写下了很久没有「这个东西是我做的」的感觉，周五回了他，约在下周二。\n\n周末你换了新跑鞋，画了修鞋铺，把面包店的画送给了老板娘，还教妈妈拍了月亮。早睡这周连着${num(s.sleep)}天。`,
    energy_note: '周五的临时需求让精力跌到最低；有跑步和画画的日子最好。',
    forgotten: ['给修鞋铺老伯画一张新招牌', '整理一份「少开会」的小方法，分享给组里'],
    next: '上线那周，至少保住两天十二点前睡。',
    lenses: { health: '跑了两次，早睡连着六天。', energy: '会议变短后明显轻松。', career: '改版下周上线，阿杰带来新机会。', relation: '阿杰、修鞋铺老伯、面包店、妈妈。' },
  }),
  3: s => ({
    title: '上线了，你也开始想走',
    letter: `这周你写了${num(s.letters)}封信，有一封只有三行。\n\n周一到周三几乎都给了会员改版：从早上九点改到晚上十点半，上线前夜改到凌晨一点，早睡断了三天。你放下了「每天早上六点起来画半小时」，备注里写着「上线这周根本起不来」。周二你溜出去和阿杰喝了咖啡，他说「你做的每个按钮，第二天书店老板就会用到」。周四改版上线，点击比旧版高了一点。\n\n周末你睡了十个小时，跑了最长的四公里，在市集看到别人卖明信片。周日晚上你列了一张留下和离开的好处坏处，写「去」的那一栏，字越写越大。`,
    energy_note: '周三是这段时间的最低点（1 分），上线后的周末回到 4 分。',
    forgotten: ['把画的小店做成一套明信片'],
    next: '想清楚要不要继续和工作室聊，先把作品集准备出来。',
    lenses: { health: '早睡断了三天，周末补了回来。', energy: '上线前夜见底，周末回升。', career: '改版上线，开始认真考虑工作室。', relation: '阿杰的一句话留在了你心里。' },
  }),
  2: s => ({
    title: '借阅卡和第一个五公里',
    letter: `这周你写了${num(s.letters)}封信，几乎都和那家工作室有关。周一挑作品集，删掉了一半想放的；周三见了创始人，她一直在问你为什么做设计，给了你一道借阅卡的题；周五你交了三版里最简单的那版，然后第一次跑满了五公里。\n\n这周你放下了今年的设计大赛，备注里写着「时间都给了面试」；也放下了去看插画展，因为票没抢到，那天你去花店画了画。\n\n周日小满来吃饭，把你画的店一张张摆在桌上。早睡又接上了，这周有${num(s.sleep)}天。`,
    energy_note: '这周精力很稳，最好的时候都在晚上。',
    forgotten: ['把书还给小满'],
    next: '等工作室的消息，先把会员改版的复盘写出来。',
    lenses: { health: '第一次跑满五公里，早睡又接上了。', energy: '整周平稳，偏高。', career: '面试、交题，走得很快。', relation: '小满来家里，花店第一次被人画。' },
  }),
  1: s => ({
    title: '你决定了，去',
    letter: `这周你写了${num(s.letters)}封信，是做决定的一周。\n\n周一收到 offer，你高兴了十分钟，然后开始害怕。周二给妈妈打电话，她说「你自己想好就行，钱少点没关系，别老熬夜」。周三早上你把第一封信翻出来重读，中午回复了工作室：去。\n\n周五你想了一整天怎么跟老周开口，第一句话已经想好了。周六你画了第四家店，旧书店老板说你做的东西他第一个用。\n\n会员改版的复盘写了一半，还没发出去。`,
    energy_note: '害怕和决定都没让精力掉下去，跑步和画画的日子依然最好。',
    forgotten: ['把会员改版的数据复盘发给老周', '把书还给小满'],
    next: '和老周把话说开，定下交接和入职的时间。',
    lenses: { health: '跑了五公里，早睡一直没断。', energy: '情绪起伏大，精力没有低于 3 分。', career: '接受 offer，准备和老周谈。', relation: '妈妈和旧书店老板都在支持你。' },
  }),
};

const QUARTER = s => ({
  title: '从会议的间隙，到靠窗的桌子',
  letter: `这一季的信是从${s.firstCn}开始的，到现在一共${s.letters}封。\n\n主线很清楚：第一封信里你问自己，是在做设计，还是在开会的间隙做设计。之后你把周会缩短了二十分钟，扛过了会员改版的上线，也接住了阿杰带来的机会：喝咖啡、列好处坏处、做借阅卡的题，最后在重读第一封信的那个早上决定了去。昨晚，你和老周把话说开了。\n\n另一条线一直在旁边：你从两公里跑到了五公里，早睡断过又接上，楼下的小店画到了第四家。精力最低的日子都和会议、加班有关，最高的日子都在会议之外。`,
  lenses: {
    health: '跑步从两公里到五公里，早睡断过又接上。卡在加班的晚上。',
    energy: '会议和临时需求是最大的消耗，跑步和画画最能回血。',
    career: '改版顺利上线，接受了小工作室的 offer，交接刚开始。',
    relation: '小满、阿杰、妈妈都在关键的时候在。和老周的话刚说开。',
  },
  plans: {
    health: '每周跑三次，月底跑一次十公里。',
    energy: '新工作开始后，每周留两个不开会的下午。',
    career: '月底前写完交接清单，入职第一个月做完一个小功能。',
    relation: '每个月给妈妈寄一张自己画的明信片。',
  },
});

const YEAR = s => ({
  title: '今年，你开始给自己写信',
  letter: `今年的信不多，是从${s.firstCn}才开始写的，到现在${s.letters}封。但这些信里，有一个完整的转弯。\n\n你在第一封信里写，会开得太多，真正画图的时间不到一个小时。后来的信里，你一点点把时间拿回来：议程提前发，会短了二十分钟；下班去河边跑步，从两公里到五公里；周末坐在小店门口画画，面包店、修鞋铺、花店、旧书店。\n\n然后是那条消息、那杯咖啡、那张好处坏处的纸、那张借阅卡。在妈妈那句「你自己想好就行」之后，你决定去一家八个人的工作室，去找回「这个东西是我做的」的感觉。\n\n这一年还没有过完。到现在为止，你信里写得最多的是会议、跑步和画画。`,
  themes: ['会议', '跑步', '画小店', '换工作', '早睡'],
  lenses: { health: '跑步成了习惯，早睡还在练。', energy: '把时间一点点从会议里拿回来。', career: '从大公司的会议里，走向一家小工作室。', relation: '小满、阿杰、妈妈，和那几家小店的老板。' },
});

function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayStr(nowMs) {
  const d = new Date((nowMs || Date.now()) + 8 * 3600e3);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekKey(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function quarterKey(s) { return s.slice(0, 4) + '-Q' + (Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1); }
function quarterStart(s) { return s.slice(0, 4) + '-' + pad((Math.floor((Number(s.slice(5, 7)) - 1) / 3)) * 3 + 1) + '-01'; }
function cn(s) { return Number(s.slice(5, 7)) + '月' + Number(s.slice(8, 10)) + '日'; }
const bjIso = (d, hh, mm, ss) => new Date(d + 'T' + pad(hh) + ':' + pad(mm) + ':' + pad(ss) + '+08:00').toISOString();

// nowMs：现在；name：回信怎么称呼（空就不称呼）
// 返回小程序云数据库的文档格式；网页版 demo-reset.mjs 再转成 SQL
function buildDemo(nowMs, name) {
  nowMs = nowMs || Date.now();
  const TODAY = todayStr(nowMs);
  const YDAY = addDays(TODAY, -1);
  const WK = weekKey(TODAY);
  const run = nowMs.toString(36);
  const sec = nowMs % 60;   // 回信时间的秒数每次都不同：网页版靠它让信封重新出现
  let seq = 0;
  const uid = p => p + '_demo_' + run + '_' + (seq++);
  const hi = name ? name + '，\n\n' : '';
  const stamp = new Date(nowMs).toISOString();

  // 1. 信排到日子上
  const dateOf = {};
  Object.keys(LETTERS).forEach(k => {
    const x = LETTERS[k];
    const d = addDays(WK, -7 * x.wk + x.dow - 1);
    if (d < YDAY) dateOf[k] = d;
  });
  const order = Object.keys(dateOf).map(k => Object.assign({ key: k, date: dateOf[k] }, LETTERS[k]));
  // 这周的：周一到前天，第三天空着
  let p = 0;
  for (let d = WK, i = 0; d < YDAY; d = addDays(d, 1), i++) {
    if (i === 2 || p >= POOL.length) continue;
    order.push(Object.assign({ key: 'cw' + p, date: d }, POOL[p++]));
  }
  order.push(Object.assign({ key: 'last', date: YDAY }, LAST));
  dateOf.last = YDAY;
  order.sort((a, b) => (a.date < b.date ? -1 : 1));

  const resolve = (r, src) => {
    if (!r) return '';
    let d;
    if (r.t != null) d = addDays(TODAY, r.t);
    else if (r.at) d = addDays(dateOf[r.at] || addDays(WK, -7), r.n || 0);
    else d = addDays(dateOf[src] || TODAY, r.s || 0);
    return d;
  };
  const clampPast = d => (d > YDAY ? YDAY : d);

  // 2. 点子和待办
  const attach = {};
  const att = k => (attach[k] = attach[k] || { todos: [], ideas: [] });
  const ideaId = {};
  const ideaDocs = IDEAS.map(i => {
    const id = uid('i');
    if (i.key) ideaId[i.key] = id;
    const src = dateOf[i.src] || '';
    att(i.src).ideas.push({ id: id, text: i.text });
    const at = i.at ? clampPast(dateOf[i.at] || src) : '';
    return { id: id, text: i.text, status: i.status || 'open', source_date: src, created: src,
      dropped_at: i.status === 'dropped' ? at : '', updated_at: i.status ? bjIso(at, 21, 30, sec) : stamp };
  });
  const todoDocs = TODOS.map(t => {
    const id = uid('t');
    const src = t.src ? dateOf[t.src] || '' : '';
    const created = t.created ? clampPast(resolve(t.created, t.src)) : src;
    const due = resolve(t.due, t.src);
    const done = t.done ? clampPast(resolve(t.done, t.src)) : '';
    const dropped = t.dropped ? clampPast(resolve(t.dropped, t.src)) : '';
    if (t.src && !t.fromIdea) att(t.src).todos.push({ id: id, text: t.text, due: due });
    const touched = done || dropped || (t.note ? clampPast(addDays(TODAY, -1)) : created);
    return { id: id, text: t.text, due: due, done: !!done, done_at: done, dropped_at: dropped, archived: false,
      note: t.note || '', source_date: src, created: created, updated_at: bjIso(touched, 21, 40, sec) };
  });

  // 3. 信和回信
  const letters = order.map((x, i) => {
    const sent = bjIso(x.date, 22, 5 + (i * 7) % 50, sec);
    const a = attach[x.key] || { todos: [], ideas: [] };
    return {
      date: x.date, text: x.text, energy: x.energy, mood: x.mood,
      sent_at: sent, replied_at: sent, opened: x.key !== 'last', updated_at: sent,
      reply: { summary: hi + x.reply, energy: x.energy, mood: x.mood, highlight: x.hl, lenses: x.lenses,
        todos: a.todos, ideas: a.ideas, engine: '' },
    };
  });
  const first = letters[0].date;

  // 4. 习惯和打卡
  const habits = HABITS.map((h, k) => ({ id: uid('h'), key: h[0], name: h[1], sort: k, archived: false, created: first }));
  const hid = {};
  habits.forEach(h => { hid[h.key] = h.id; });
  const logs = [];
  order.forEach(x => (x.hb || []).forEach(k => logs.push({ habit_id: hid[k], date: x.date, done: true })));
  EXTRA_LOGS.forEach(g => {
    if (!dateOf[g.at]) return;
    const d = addDays(dateOf[g.at], g.n);
    if (d < YDAY && !logs.some(x => x.habit_id === hid[g.hb] && x.date === d)) logs.push({ habit_id: hid[g.hb], date: d, done: true });
  });

  // 5. 周信 / 季信 / 年信
  const statsOf = (start, end) => {
    const ls = letters.filter(l => l.date >= start && l.date <= end);
    const avg = ls.length ? Math.round(ls.reduce((s, l) => s + l.energy, 0) / ls.length * 10) / 10 : null;
    const done = todoDocs.filter(t => t.done && t.done_at >= start && t.done_at <= end).length;
    const days = Math.round((new Date(end + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 864e5) + 1;
    const sleep = logs.filter(g => g.habit_id === hid.sleep && g.date >= start && g.date <= end).length;
    return { letters: ls.length, days: days, energyAvg: avg, todosDone: done, sleep: sleep };
  };
  const digests = [];
  [5, 4, 3, 2, 1].forEach(k => {
    const start = addDays(WK, -7 * k), end = addDays(start, 6);
    const st = statsOf(start, end);
    if (!st.letters) return;
    const c = WEEKS[k](st);
    c.letter = hi + c.letter;
    c.engine = '';
    c.stats = { letters: st.letters, days: st.days, energyAvg: st.energyAvg, todosDone: st.todosDone };
    c.range = [start, end];
    digests.push({ kind: 'week', key: start, created_at: bjIso(addDays(end, 1), 6, 0, 0), content: c });
  });
  const made = bjIso(TODAY, 0, 30, sec);   // 季信、年信：昨晚让回信先写的「到目前为止」
  const qs = quarterStart(YDAY);
  const qst = statsOf(qs, YDAY);
  const qFirst = letters.filter(l => l.date >= qs)[0];
  if (qst.letters) {
    const c = QUARTER(Object.assign({ firstCn: cn(qFirst.date) }, qst));
    c.letter = hi + c.letter;
    c.engine = '';
    c.stats = { letters: qst.letters, days: qst.days, energyAvg: qst.energyAvg, todosDone: qst.todosDone };
    c.range = [qs, YDAY];
    digests.push({ kind: 'quarter', key: quarterKey(YDAY), created_at: made, content: c });
  }
  const ys = YDAY.slice(0, 4) + '-01-01';
  const yst = statsOf(ys, YDAY);
  const yFirst = letters.filter(l => l.date >= ys)[0];
  if (yst.letters) {
    const c = YEAR(Object.assign({ firstCn: cn(yFirst.date) }, yst));
    c.letter = hi + c.letter;
    c.engine = '';
    c.stats = { letters: yst.letters, days: yst.days, energyAvg: yst.energyAvg, todosDone: yst.todosDone };
    c.range = [ys, YDAY];
    digests.push({ kind: 'year', key: YDAY.slice(0, 4), created_at: made, content: c });
  }

  return {
    today: TODAY,
    letters: letters,
    todos: todoDocs,
    ideas: ideaDocs,
    habits: habits.map(h => ({ id: h.id, name: h.name, sort: h.sort, archived: false, created: h.created })),
    logs: logs,
    digests: digests,
  };
}

module.exports = { buildDemo, todayStr };
