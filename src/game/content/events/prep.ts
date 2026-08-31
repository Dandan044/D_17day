import type { EventFamily } from '../../types';

/**
 * 准备期事件（Day 1-7）。
 *
 * 这七天的主题是"信息不足下的押注"：你不知道要来的是什么，
 * 而每一次采购、每一次拒绝邻居，都会在崩溃日之后变成账单或存款。
 */
export const PREP_EVENTS: EventFamily[] = [
  // ============================================================
  {
    id: 'prep_hoarding_rush',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    baseWeight: 10,
    cooldown: 3,
    variants: [
      {
        id: 'supermarket',
        title: '超市门口排到了马路上',
        body: '晚上八点，你路过那家你每周都去的超市。队伍从生鲜区排到了马路对面。有人推着三辆购物车，有人在为最后一箱矿泉水争执。\n收银员的表情很奇怪——不是害怕，是那种"我已经不想理解今天发生了什么"的疲惫。',
        choices: [
          {
            id: 'queue',
            label: '排队，能买多少买多少',
            note: '花 1 小时，拿到打折前的价格',
            effect: {
              res: { water: 14, foodStaple: 8, cash: -700 },
              stats: { stamina: -10 },
              log: '你在超市排了两个小时，抢到了别人手慢没拿到的那些。',
              tone: 'good',
            },
          },
          {
            id: 'staff',
            label: '绕到后门找认识的理货员',
            requires: { skills: { negotiation: 2 }, reason: '需要谈判 2 级' },
            effect: {
              res: { water: 20, foodStaple: 12, cash: -1400 },
              stats: { reputation: -3 },
              log: '你从后门拿到了还没上架的货。排队的人看见了，其中有人记住了你的脸。',
              tone: 'good',
            },
          },
          {
            id: 'skip',
            label: '算了，明天再说',
            effect: {
              world: { scarcity: 3 },
              log: '你转身走了。明天这里会更空。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'gasline',
        title: '加油站排队时前面吵起来了',
        body: '两个男人在为加油顺序推搡。工作人员喊了几声就退回了便利店，把门锁了。\n你的油表还有半箱。前面还有六辆车。',
        require: { any: ['res:fuel<20'] },
        choices: [
          {
            id: 'wait',
            label: '等着，加满',
            effect: {
              res: { fuel: 22, cash: -600 },
              stats: { stamina: -8 },
              log: '你加满了油。等的时候听见后面有人在打电话哭。',
              tone: 'good',
            },
          },
          {
            id: 'jerrycan',
            label: '同时买两个油桶灌满',
            requires: { res: { cash: 1400 } },
            effect: {
              res: { fuel: 40, cash: -1400, parts: 1 },
              stats: { stamina: -14, reputation: -4 },
              log: '你灌了两桶带回家。后面排队的人在骂你。',
              tone: 'good',
            },
          },
          {
            id: 'leave',
            label: '不掺和，开走',
            effect: { log: '你掉头走了。半箱油，够跑一百公里。', tone: 'neutral' },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_neighbor_asks',
    kind: 'moral',
    intensity: 2,
    phase: ['prep'],
    baseWeight: 9,
    cooldown: 3,
    variants: [
      {
        id: 'lijie_water',
        title: '李姐来敲门',
        body: '三楼的李姐站在门口，手里攥着一个空水壶。她一个人带孩子，你知道的。\n"小区停水通知贴出来了，说是检修。我看你昨天搬了好几箱水上来……"\n她没把话说完。她也不好意思说完。',
        require: { none: ['neighbors:hostile'] },
        choices: [
          {
            id: 'give',
            label: '给她 8 L 水',
            requires: { res: { water: 8 } },
            effect: {
              res: { water: -8 },
              stats: { humanity: 5, reputation: 4 },
              world: { neighborhood: 12 },
              stance: { neighbors: 10 },
              setFlags: ['flag:helpedLijie'],
              schedule: [{ familyId: 'prep_neighbor_repay', inDays: 3 }],
              log: '你给了李姐八升水。她说等来水了一定还你。',
              tone: 'good',
            },
          },
          {
            id: 'share_info',
            label: '不给水，但告诉她该去哪买',
            effect: {
              stats: { humanity: 1 },
              world: { neighborhood: 3 },
              log: '你告诉李姐哪家便利店还有存货。她谢了你，但眼神里有点别的东西。',
              tone: 'neutral',
            },
          },
          {
            id: 'refuse',
            label: '说家里也不够',
            effect: {
              stats: { humanity: -6, reputation: -5 },
              world: { neighborhood: -14 },
              stance: { neighbors: -12 },
              setFlags: ['flag:refusedLijie'],
              log: '你说家里也不够。她点点头说理解，然后下楼了。你关门的时候手停了一下。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'child_medicine',
        title: '有人在楼道里问有没有退烧药',
        body: '二楼那家的孩子从昨晚开始发烧，三十九度二。医院的号已经排到了后天。\n孩子的父亲站在楼梯口，看谁下楼就问一句。他已经问了很多人了。',
        require: { any: ['res:meds>=2'] },
        choices: [
          {
            id: 'give_meds',
            label: '给他 2 组药',
            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 7, reputation: 6 },
              world: { neighborhood: 15 },
              setFlags: ['flag:savedChild'],
              schedule: [{ familyId: 'prep_neighbor_repay', inDays: 4 }],
              log: '你给了那家人退烧药。孩子的父亲握着你的手说了三遍谢谢。',
              tone: 'good',
            },
          },
          {
            id: 'drive',
            label: '开车送他们去别的医院',
            requires: { tags: { all: ['hasVehicle'] }, reason: '需要有车' },
            effect: {
              res: { fuel: -6 },
              stats: { stamina: -18, humanity: 9, reputation: 8 },
              world: { neighborhood: 20 },
              setFlags: ['flag:savedChild'],
              log: '你开了四十公里把他们送到了郊区的医院。回来的路上油表见底。',
              tone: 'good',
            },
          },
          {
            id: 'no',
            label: '说没有',
            effect: {
              stats: { humanity: -8, sanity: -3 },
              world: { neighborhood: -10 },
              setFlags: ['flag:refusedChild'],
              log: '你说没有。你有。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_neighbor_repay',
    kind: 'social',
    intensity: 1,
    phase: ['prep', 'survival'],
    baseWeight: 0,
    variants: [
      {
        id: 'repay',
        title: '有人在你门口放了东西',
        body: '一个纸箱，上面压着一张便条："谢谢。用得上的话就拿着。"没有署名。\n里面是几袋米、两包挂面、一卷胶带，还有一小袋盐。都是很实在的东西。',
        choices: [
          {
            id: 'take',
            label: '收下',
            effect: {
              res: { foodStaple: 6, materials: 2 },
              stats: { humanity: 2, sanity: 4 },
              world: { neighborhood: 6 },
              log: '你把箱子搬进屋。人和人之间还有一些东西没坏掉。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_coalarm',
    kind: 'opportunity',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 7,
    once: true,
    variants: [
      {
        id: 'hardware_tip',
        title: '五金店老板多说了一句',
        body: '王老板一边给你装木板一边说："你要真打算封窗户，那买个这个。"\n他从柜台底下摸出一个白色的小圆盘，巴掌大，六十八块。"一氧化碳报警器。密封做太好，屋里烧个炉子就能出事。前年我们这条街有一家人，三口，全是这么走的。"\n六十八块。你今天已经花了两千多。',
        choices: [
          {
            id: 'buy',
            label: '买一个（68 元）',
            requires: { res: { cash: 68 } },
            effect: {
              res: { cash: -68 },
              setFlags: ['flag:coAlarm'],
              log: '你买了个一氧化碳报警器，随手扔进了工具箱。六十八块。',
              tone: 'good',
            },
          },
          {
            id: 'buy_two',
            label: '买两个，一个给邻居（136 元）',
            requires: { res: { cash: 136 } },
            effect: {
              res: { cash: -136 },
              stats: { humanity: 4 },
              world: { neighborhood: 6 },
              setFlags: ['flag:coAlarm'],
              log: '你买了两个，把其中一个塞进了李姐家的门缝。',
              tone: 'good',
            },
          },
          {
            id: 'skip',
            label: '不用，我又不是没常识',
            effect: { log: '你没买。王老板耸了耸肩，把那个白圆盘放回了柜台底下。', tone: 'neutral' },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_iodine',
    kind: 'opportunity',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 6,
    once: true,
    variants: [
      {
        id: 'pharmacy',
        title: '药店的碘片还剩两盒',
        body: '柜台后的年轻店员指了指最上层："今天来问这个的第十一个人了。上午还有一整箱。"\n价格是平时的六倍。碘化钾片，一盒二十片，够一个人吃十天。\n它只在一种情况下有用。而你并不确定是不是那一种。',
        choices: [
          {
            id: 'buy_both',
            label: '两盒都要',
            requires: { res: { cash: 900 } },
            effect: {
              res: { cash: -900, meds: 1 },
              setFlags: ['flag:iodine'],
              log: '你买了两盒碘片。如果猜错了，这九百块就是买了个心安。',
              tone: 'neutral',
            },
          },
          {
            id: 'buy_one',
            label: '买一盒就够了',
            requires: { res: { cash: 450 } },
            effect: {
              res: { cash: -450 },
              setFlags: ['flag:iodine'],
              log: '你买了一盒碘片。够一个人吃十天，前提是只有一个人。',
              tone: 'neutral',
            },
          },
          {
            id: 'skip',
            label: '把钱花在更可能用上的东西上',
            effect: {
              res: { meds: 2, cash: -180 },
              log: '你没买碘片，买了常规药品。这是一个理性的决定，也可能是一个错误的决定。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_vehicle',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    baseWeight: 7,
    once: true,
    forbid: { all: ['hasVehicle'] },
    variants: [
      {
        id: 'used_van',
        title: '有人在卖一辆面包车',
        body: '小区停车场那个总在修车的男人要走了。他说要回老家，车带不走。\n十四年的旧面包车，跑了二十六万公里，排气有点响，但能跑。他要一万二，现金。\n"你要真想活，"他说，"腿是不够的。"',
        choices: [
          {
            id: 'buy',
            label: '买（12000 元）',
            requires: { res: { cash: 12000 } },
            effect: {
              res: { cash: -12000, fuel: 8 },
              setFlags: ['flag:hasVehicle'],
              log: '你买下了那辆面包车。油箱里还剩八升。',
              tone: 'good',
            },
          },
          {
            id: 'haggle',
            label: '压价',
            requires: { skills: { negotiation: 3 }, reason: '需要谈判 3 级' },
            check: {
              skill: 'negotiation',
              dc: 11,
              ok: {
                res: { cash: -8500, fuel: 8 },
                setFlags: ['flag:hasVehicle'],
                log: '你把价格压到了八千五。他说算了，反正带不走。',
                tone: 'good',
              },
              bad: {
                res: { cash: -12000, fuel: 8 },
                stats: { sanity: -2 },
                setFlags: ['flag:hasVehicle'],
                log: '他不肯让价，还多要了几百。你还是买了。',
                tone: 'neutral',
              },
            },
          },
          {
            id: 'cart',
            label: '买不起车，去弄一辆手推车',
            effect: {
              res: { cash: -300 },
              setFlags: ['flag:hasCart'],
              log: '你花三百块买了辆建材市场的手推车。载重四十公斤，总比背着强。',
              tone: 'neutral',
            },
          },
          { id: 'skip', label: '不需要', effect: { log: '你没买车。', tone: 'neutral' } },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_gun',
    kind: 'opportunity',
    intensity: 3,
    phase: ['prep'],
    baseWeight: 5,
    once: true,
    variants: [
      {
        id: 'blackmarket',
        title: '旧货市场后面那个人',
        body: '他先问你要不要买刀，你摇头。他又看了你两秒，说跟我来。\n铁皮棚子后面，一个帆布包。一把老式猎枪，枪管有锈，还有三十发弹。\n"两万四。别问来路，我也不问你要干什么。"\n这东西能救你的命，也能让你在下周被人一枪打死。',
        choices: [
          {
            id: 'buy',
            label: '买下（24000 元）',
            requires: { res: { cash: 24000 } },
            effect: {
              res: { cash: -24000, ammo: 30 },
              stats: { sanity: -5, humanity: -3 },
              setFlags: ['flag:hasGun'],
              log: '你带回了一把猎枪。它现在躺在衣柜最里面，用毛巾包着。',
              tone: 'neutral',
            },
          },
          {
            id: 'ammo_only',
            label: '只买弹药，枪不要',
            requires: { res: { cash: 3000 } },
            effect: {
              res: { cash: -3000, ammo: 12 },
              log: '你只买了弹药。你不确定为什么，但你买了。',
              tone: 'neutral',
            },
          },
          {
            id: 'report',
            label: '走开，然后报警',
            effect: {
              stats: { humanity: 4, reputation: 3 },
              world: { lawOrder: 1 },
              faction: { gang: -5 },
              stance: { gang: -20 },
              log: '你报了警。接线员的声音很累，说会记录。你不知道会不会有人来。',
              tone: 'neutral',
            },
          },
          { id: 'walk', label: '什么都不做', effect: { log: '你走开了。', tone: 'neutral' } },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_family_call',
    kind: 'story',
    intensity: 3,
    phase: ['prep'],
    baseWeight: 8,
    once: true,
    variants: [
      {
        id: 'mother',
        title: '你妈打来电话',
        body: '"新闻里说的那个事，是真的吗？"\n她在两百公里外的县城，一个人住。你听得见她那边电视的声音。\n"要不我过去？"她问，"还是你回来？"\n你手里正拿着一卷密封胶带。',
        choices: [
          {
            id: 'come_here',
            label: '让她来，你去接',
            requires: { tags: { all: ['hasVehicle'] }, reason: '需要有车才能去接' },
            effect: {
              res: { fuel: -18 },
              stats: { stamina: -24, sanity: 12, humanity: 8 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:familyHere'],
              log: '你开了四小时把她接过来了。她带了两个装满腌菜的坛子和一整包药。',
              tone: 'good',
            },
          },
          {
            id: 'stay',
            label: '让她留在县城，那里人少',
            effect: {
              stats: { sanity: -8, humanity: 2 },
              setFlags: ['flag:familyAway'],
              schedule: [{ familyId: 'story_family_radio', inDays: 12 }],
              log: '你让她别动，说县城人少更安全。挂电话前她说了句"你自己当心"。',
              tone: 'grim',
            },
          },
          {
            id: 'lie',
            label: '说都是谣言，让她别担心',
            effect: {
              stats: { sanity: -12, humanity: -6 },
              setFlags: ['flag:familyLied'],
              schedule: [{ familyId: 'story_family_radio', inDays: 10 }],
              log: '你说都是谣言。她信了，还笑了。你挂了电话，继续贴胶带。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_workplace',
    kind: 'social',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 7,
    cooldown: 4,
    variants: [
      {
        id: 'boss',
        title: '公司群里发了通知',
        body: '"针对近期网络传言，公司提醒各位员工不要轻信谣言、不要传播恐慌。明日起正常上班，无故缺勤按旷工处理。"\n下面有三十个"收到"。你盯着输入框。\n你还有四天。',
        choices: [
          {
            id: 'go',
            label: '去上班',
            note: '拿到这个月的工资',
            effect: {
              res: { cash: 4200 },
              stats: { stamina: -20 },
              log: '你去上班了。整个办公室没有人提这件事，所有人都在刷手机。',
              tone: 'neutral',
            },
          },
          {
            id: 'quit',
            label: '辞职，把时间全用在准备上',
            effect: {
              stats: { sanity: -4 },
              setFlags: ['flag:quitJob'],
              log: '你发了辞职信，没等回复。从今天起你只有一件事要做。',
              tone: 'neutral',
            },
          },
          {
            id: 'warn',
            label: '在群里把你知道的都说了',
            effect: {
              stats: { humanity: 6, reputation: -8, sanity: -3 },
              world: { neighborhood: 4 },
              log: '你在群里把你查到的都发了。两个人私聊你说谢谢，其他人当你疯了。HR 让你注意言论。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_scam',
    kind: 'social',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 6,
    cooldown: 5,
    variants: [
      {
        id: 'kit',
        title: '有人在小区门口卖应急包',
        body: '一辆三轮车，一块手写纸板："家庭应急生存包 998 元/套 限量"。\n包里能看见压缩饼干、一件雨衣、一个手电、几根蜡烛。你估算了一下，成本不到一百八。\n围着看的人不少，已经有两个在扫码。',
        choices: [
          {
            id: 'expose',
            label: '当众算给大家听',
            effect: {
              stats: { humanity: 5, reputation: 6 },
              world: { neighborhood: 8 },
              log: '你把每样东西的市价当众报了一遍。卖的人收摊走了，有个大姐拉着你问该买什么。',
              tone: 'good',
            },
          },
          {
            id: 'buy_cheap',
            label: '压价买两套（自己拆用）',
            requires: { res: { cash: 900 } },
            check: {
              skill: 'negotiation',
              dc: 9,
              ok: {
                res: { cash: -900, foodStaple: 4, materials: 2, parts: 2 },
                log: '你花九百拿了两套，拆开发现手电还挺好用。',
                tone: 'good',
              },
              bad: {
                res: { cash: -1996, foodStaple: 4, materials: 2 },
                log: '他一分不让。你还是买了两套。回家拆开的时候有点后悔。',
                tone: 'neutral',
              },
            },
          },
          { id: 'ignore', label: '不管，走了', effect: { log: '你走开了。身后有人在扫码付款。', tone: 'neutral' } },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_pet',
    kind: 'moral',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 5,
    once: true,
    forbid: { all: ['hasPet'] },
    variants: [
      {
        id: 'dog',
        title: '楼道里有一条狗',
        body: '中华田园犬，一岁多，脖子上有项圈但没牌子。对门那家昨天搬走了。\n它没有叫，只是在他们家门口趴着，看见你上楼就抬了下头。\n养它要吃粮，会叫，会招来注意。但狗的耳朵比你好用得多。',
        choices: [
          {
            id: 'take',
            label: '带它回家',
            effect: {
              res: { foodStaple: -2 },
              stats: { sanity: 10, humanity: 6 },
              setFlags: ['flag:hasPet', 'flag:petDog'],
              log: '你把它带回了家。它趴在门口，朝着楼梯的方向。',
              tone: 'good',
            },
          },
          {
            id: 'feed',
            label: '喂点东西，但不带走',
            effect: {
              res: { foodStaple: -1 },
              stats: { humanity: 2, sanity: -2 },
              log: '你放了一碗东西在它面前，然后关上了自己的门。',
              tone: 'neutral',
            },
          },
          {
            id: 'ignore',
            label: '你养不起',
            effect: {
              stats: { sanity: -4, humanity: -2 },
              log: '你从它旁边走过去了。第二天它还在那儿，第三天就不在了。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_evacuate',
    kind: 'moral',
    intensity: 4,
    phase: ['prep'],
    baseWeight: 6,
    once: true,
    minThreat: 0,
    variants: [
      {
        id: 'convoy',
        title: '有人组了车队要出城',
        body: '业主群里有人发起了自驾出城，说是去西边山区的农家乐包场，已经有十一户报名。\n出发时间是明天早上六点。他们要每户三千块，用于统一采购。\n"留在城里就是等死。"发起人这么说。他可能是对的，也可能只是害怕。',
        choices: [
          {
            id: 'join',
            label: '报名（3000 元）',
            requires: { res: { cash: 3000 }, tags: { all: ['hasVehicle'] }, reason: '需要车和 3000 元' },
            effect: {
              res: { cash: -3000 },
              stats: { sanity: 5 },
              setFlags: ['flag:convoyKnown'],
              schedule: [{ familyId: 'story_convoy_news', inDays: 9 }],
              log: '你报了名，交了三千。然后一整晚都在想要不要真的去。',
              tone: 'neutral',
            },
          },
          {
            id: 'stay',
            label: '不去，你已经决定守在这里',
            effect: {
              stats: { sanity: -3, humanity: 1 },
              setFlags: ['flag:choseToStay'],
              log: '你没报名。这栋楼里你最熟，而路上的事没人说得清。',
              tone: 'neutral',
            },
          },
          {
            id: 'warn',
            label: '劝他们别走，路上更危险',
            check: {
              skill: 'negotiation',
              dc: 13,
              ok: {
                stats: { humanity: 6, reputation: 8 },
                world: { neighborhood: 14 },
                log: '你把交通管制和路况一条条说了。有六户退出了车队，留下来跟你一起加固楼门。',
                tone: 'good',
              },
              bad: {
                stats: { reputation: -5 },
                world: { neighborhood: -6 },
                log: '你说了很多，但没人听。发起人说你是在散播恐慌。',
                tone: 'neutral',
              },
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_stranger_generator',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    baseWeight: 6,
    cooldown: 6,
    variants: [
      {
        id: 'generator',
        title: '有人要转让一台发电机',
        body: '同城二手平台，五分钟前发布：柴油发电机 5 kW，九成新，一万六，只接受面交现金。\n照片看着是真的。但地址在城东的一个仓库区，而且他说"必须今晚"。\n这可能是清库存的商家，也可能是三个人拿着撬棍在等你。',
        choices: [
          {
            id: 'go_alone',
            label: '带钱去',
            requires: { res: { cash: 16000 } },
            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                res: { cash: -16000 },
                shelter: { power: 2 },
                log: '是真的。你把那台机器搬回来，用了两趟。',
                tone: 'good',
              },
              bad: {
                res: { cash: -16000 },
                stats: { hp: -18, sanity: -10 },
                addCond: ['woundInfection'],
                setFlags: ['flag:robbedOnce'],
                log: '仓库里只有三个人和一根钢管。钱没了，你的左臂被划开一道口子。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'go_daylight',
            label: '坚持改成白天、换公共场所',
            check: {
              skill: 'negotiation',
              dc: 9,
              ok: {
                res: { cash: -17500 },
                shelter: { power: 2 },
                log: '你坚持改到白天在派出所门口交易。他答应了，还多要了一千五。机器是真的。',
                tone: 'good',
              },
              bad: {
                log: '对方直接把你拉黑了。你不知道是躲开了一个骗局，还是错过了一台发电机。',
                tone: 'neutral',
              },
            },
          },
          { id: 'skip', label: '不去', effect: { log: '你没去。十分钟后帖子删了。', tone: 'neutral' } },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_landlord',
    kind: 'social',
    intensity: 2,
    phase: ['prep'],
    baseWeight: 5,
    cooldown: 5,
    require: { any: ['site:urban', 'site:highFloor', 'site:underground'] },
    variants: [
      {
        id: 'property',
        title: '物业在楼道贴了告示',
        body: '"关于近期部分住户擅自改造门窗、堆放杂物的整治通知：请于三日内自行恢复原状，否则将强制清理并追究责任。"\n下面有人用笔写了一行："你们清理试试。"\n你的窗户已经钉上了木板。',
        choices: [
          {
            id: 'bribe',
            label: '找物业主任私下沟通',
            requires: { res: { cash: 1500 } },
            effect: {
              res: { cash: -1500 },
              stats: { reputation: -2 },
              setFlags: ['flag:propertyDeal'],
              log: '你请物业主任抽了根烟，塞了个红包。他说他什么也没看见。',
              tone: 'good',
            },
          },
          {
            id: 'organize',
            label: '联合其他住户一起顶回去',
            check: {
              skill: 'negotiation',
              dc: 10,
              ok: {
                world: { neighborhood: 16 },
                stats: { reputation: 6 },
                res: { materials: 4 },
                log: '你把七户人家凑到了楼道里。物业撤了通知，还有人把自家剩的木板给了你。',
                tone: 'good',
              },
              bad: {
                world: { neighborhood: -6 },
                stats: { reputation: -4 },
                log: '没人愿意出面。有个大爷说你就是那个搞事的。',
                tone: 'neutral',
              },
            },
          },
          {
            id: 'comply',
            label: '先拆掉，等等再说',
            effect: {
              shelter: { fortify: -1 },
              stats: { sanity: -4 },
              log: '你把木板拆了下来，靠在阳台角落。三天后你会重新钉上去，用两倍的时间。',
              tone: 'bad',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'prep_intel_conflict',
    kind: 'story',
    intensity: 1,
    phase: ['prep'],
    baseWeight: 8,
    cooldown: 3,
    variants: [
      {
        id: 'two_reports',
        title: '两份通报互相矛盾',
        body: '一份是市级的，说"生产生活秩序正常，请勿传播不实信息"。\n另一份是同一天下午区级发的，要求"各单位做好应急物资储备并上报库存"。\n它们同时挂在两个官方账号上，谁也没删。',
        choices: [
          {
            id: 'analyze',
            label: '交叉比对，找出哪份更可信',
            requires: { ap: 1 },
            check: {
              skill: 'negotiation',
              dc: 8,
              ok: {
                ap: -1,
                setFlags: ['flag:intelBonus'],
                stats: { sanity: 3 },
                log: '你把两份通报的落款单位、发布时间和往年同类文件对了一遍。你现在更清楚该信什么。',
                tone: 'good',
              },
              bad: {
                ap: -1,
                stats: { sanity: -4 },
                log: '你看了两个小时，唯一的结论是：他们自己也不知道。',
                tone: 'neutral',
              },
            },
          },
          {
            id: 'trust_local',
            label: '信区级那份，按最坏情况准备',
            effect: {
              stats: { sanity: -2 },
              setFlags: ['flag:assumeWorst'],
              log: '你决定信下面那一级。越靠近地面的通知越诚实，这是你的经验。',
              tone: 'neutral',
            },
          },
          {
            id: 'ignore',
            label: '不看了，去干活',
            effect: {
              stats: { stamina: 6 },
              log: '你关掉手机去搬东西。有些时候，做比想有用。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  },
];
