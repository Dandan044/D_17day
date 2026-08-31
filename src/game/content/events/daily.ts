import type { EventFamily } from '../../types';

/**
 * 日常生存事件：门槛低、可用面广，负责填满每一天。
 *
 * survival.ts 里那些是"当某个特定条件成立时才合理"的事件，
 * 这个文件里的是"任何一天都可能发生"的事件——两者一起才构成一个不会枯竭的池子。
 */
export const DAILY_EVENTS: EventFamily[] = [
  // ============================================================
  {
    id: 'daily_stranger_at_door',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 10,
    cooldown: 4,
    forbid: { all: ['site:isolated'] },
    variants: [
      {
        id: 'old_man',
        title: '门外站着一个老人',
        body: '他大概七十岁，穿着一件不合身的羽绒服，手里拎着一个空的塑料袋。\n"我不是要东西，"他说，"我想问一下，你知道今天是几号吗？"\n他问的是日期。你花了几秒才明白，他真的只是想知道日期。',
        choices: [
          {
            id: 'tell',
            label: '告诉他日期，再给点吃的',
            requires: { res: { foodStaple: 1 } },
            effect: {
              res: { foodStaple: -1 },
              stats: { humanity: 5, sanity: 4 },
              world: { exposure: 3, neighborhood: 4 },
              log: '你告诉他今天是第几天，又塞了一份罐头给他。他把日期念了两遍，像是要记住。',
              tone: 'good',
            },
          },
          {
            id: 'tell_only',
            label: '只告诉他日期',
            effect: {
              stats: { humanity: 1 },
              world: { exposure: 1 },
              log: '你说了日期。他道了谢，慢慢下了楼。',
              tone: 'neutral',
            },
          },
          {
            id: 'silent',
            label: '不出声',
            effect: {
              stats: { humanity: -3, sanity: -4 },
              log: '你没应门。他在外面又站了一会儿，然后走了。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'wounded',
        title: '楼下有个人在流血',
        body: '小腿上一道很深的口子，从裤腿一直往下渗。他自己用围巾扎了，但扎的位置不对。\n"三条街外，"他喘着气说，"有人抢我的车。我跑掉了。"\n他看着你，然后看着你身后的门。',
        choices: [
          {
            id: 'treat',
            label: '把他弄进来处理伤口',
            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 8, stamina: -8 },
              world: { exposure: 7 },
              setFlags: ['flag:savedWounded'],
              schedule: [{ familyId: 'daily_debt_repaid', inDays: 3 }],
              log: '你把他扶进来，重新扎了止血带，缝了六针。他一直没喊。',
              tone: 'good',
            },
          },
          {
            id: 'supplies_only',
            label: '给他药，让他在外面处理',
            requires: { res: { meds: 1 } },
            effect: {
              res: { meds: -1 },
              stats: { humanity: 3 },
              world: { exposure: 3 },
              log: '你从门缝递出纱布和碘伏。他在楼道里自己包好，然后走了。',
              tone: 'neutral',
            },
          },
          {
            id: 'refuse',
            label: '让他走',
            effect: {
              stats: { humanity: -6, sanity: -5 },
              log: '你让他走。他没有争辩，这让你更难受。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'knows_you',
        title: '有人叫出了你的名字',
        body: '"是我，"他说，"以前在你那儿买过烟。"\n你不记得他。但他知道你姓什么，知道你住几楼，甚至知道你以前的作息。\n"我就住三站路外。我们这样的，得互相帮着。"',
        choices: [
          {
            id: 'trust',
            label: '让他进来聊聊',
            effect: {
              world: { exposure: 9 },
              stats: { sanity: 5 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:trustedStranger'],
              log: '你让他进来了。他很健谈，也确实帮了忙。你还是不记得他。',
              tone: 'neutral',
            },
          },
          {
            id: 'careful',
            label: '在门外和他说话，不开门',
            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                world: { exposure: -3 },
                log: '你隔着门聊了十分钟，什么也没透露。他最后说"那算了"，走了。',
                tone: 'good',
              },
              bad: {
                world: { exposure: 8 },
                log: '你以为自己什么都没说，但他临走时提了一句"你们家水挺够的啊"。你不记得自己说过。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'reject',
            label: '说你认错人了',
            effect: {
              world: { exposure: 2 },
              stats: { humanity: -2 },
              log: '你说他认错人了。他笑了一下，说"行"。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_debt_repaid',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 0,
    variants: [
      {
        id: 'returns',
        title: '那个人回来了',
        body: '腿还有点跛，但能走。他背着一个鼓鼓的登山包。\n"我回去把车找到了，"他说，"里面的东西还在。这些你拿着。"\n他没等你客气，把包放下就走了。',
        require: { any: ['flag:savedWounded'] },
        choices: [
          {
            id: 'accept',
            label: '收下',
            effect: {
              res: { foodStaple: 6, meds: 3, fuel: 8, parts: 3 },
              stats: { sanity: 8, humanity: 3 },
              log: '包里是罐头、药、两桶汽油和一把工具。你救人的时候没想过会有这一天。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_maintenance',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 9,
    cooldown: 4,
    require: { any: ['mod:power>=1', 'mod:filter>=1', 'mod:airFilter>=1'] },
    variants: [
      {
        id: 'breakdown',
        title: '有东西开始响了',
        body: '不是坏了，是"要坏了"的那种响——间隔越来越短的一声轻微咔哒。\n你趴下去听了很久，锁定了轴承的位置。现在处理要花零件和时间，等它真坏了就要花更多。',
        choices: [
          {
            id: 'fix',
            label: '现在就修（2 零件 + 1 AP）',
            requires: { res: { parts: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -2 },
              stats: { stamina: -10 },
              log: '你换了轴承，上了油。它安静下来了。',
              tone: 'good',
            },
          },
          {
            id: 'bodge',
            label: '临时应付一下',
            check: {
              skill: 'mechanics',
              dc: 11,
              ok: {
                log: '你用一段铁丝和几滴机油撑住了它。能再用一阵，但你知道这是欠账。',
                tone: 'neutral',
              },
              bad: {
                shelter: { power: -1 },
                log: '你的临时办法让它彻底停了。现在要重新接线路，等级掉了一级。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',
            label: '不管，它还能转',
            effect: {
              setFlags: ['flag:deferredMaintenance'],
              schedule: [{ familyId: 'daily_breakdown_hard', inDays: 4 }],
              log: '你决定听着它响。反正它现在还能转。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'filter_dying',
        title: '滤芯已经变色了',
        body: '拆下来看，原本白色的部分变成了灰褐，捏一下会掉粉。\n它还在工作，但效率已经不到一半。备用滤芯要用零件做，或者从别的地方拆。',
        require: { all: ['wear:filterLife<=8'] },
        choices: [
          {
            id: 'replace',
            label: '用零件做一个新滤芯（4 零件）',
            requires: { res: { parts: 4 } },
            effect: {
              res: { parts: -4 },
              wear: { filterLife: 24 },
              log: '你用活性炭、纱布和一段 PVC 管做了个替代滤芯。不如原装，但能用。',
              tone: 'good',
            },
          },
          {
            id: 'clean',
            label: '拆开清洗，能延一点',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -8 },
              wear: { filterLife: 8 },
              log: '你把滤芯反冲洗了三遍，水从黑色慢慢变成灰色。能多撑几天。',
              tone: 'neutral',
            },
          },
          {
            id: 'accept',
            label: '让它撑到彻底不行',
            effect: {
              log: '你把它装了回去。等它彻底堵死那天，你会需要另一个办法。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'daily_breakdown_hard',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    baseWeight: 0,
    variants: [
      {
        id: 'it_broke',
        title: '它彻底停了',
        body: '半夜三点，那个声音突然没有了。不是修好了，是停了。\n你打着手电过去看，轴已经卡死，外壳烫得不能碰。你早就听见它在求救了。',
        require: { any: ['flag:deferredMaintenance'] },
        choices: [
          {
            id: 'rebuild',
            label: '大修（6 零件 + 1 AP）',
            requires: { res: { parts: 6 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -6 },
              stats: { stamina: -14 },
              clearFlags: ['flag:deferredMaintenance'],
              log: '你花了一整天把它拆到底再装回去。这次你上足了油。',
              tone: 'neutral',
            },
          },
          {
            id: 'lose',
            label: '没零件了，接受它坏掉',
            effect: {
              shelter: { power: -1 },
              stats: { sanity: -6 },
              clearFlags: ['flag:deferredMaintenance'],
              log: '你没有零件。它就那样停在那里，成了屋里最大的一件废铁。',
              tone: 'bad',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_hygiene',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 8,
    cooldown: 5,
    variants: [
      {
        id: 'rats',
        title: '米袋被咬开了',
        body: '底下一个小洞，周围是碎屑和更小的、深色的颗粒。\n老鼠不是一只。它们知道这里有食物，而且它们比你更擅长在墙里生活。',
        choices: [
          {
            id: 'seal',
            label: '把所有食物移进密封容器（1 AP）',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { foodStaple: -1, materials: -1 },
              stats: { stamina: -8 },
              setFlags: ['flag:sealedFood'],
              log: '你把所有能吃的东西转移进了铁桶和塑料箱，缝隙用胶带封死。损失了一点，但止住了。',
              tone: 'good',
            },
          },
          {
            id: 'trap',
            label: '做几个陷阱',
            check: {
              skill: 'mechanics',
              dc: 9,
              ok: {
                res: { foodFresh: 1 },
                log: '你用铁丝和木板做了四个翻板陷阱。第二天早上有三个响了。你没细看那"生鲜食物"是什么。',
                tone: 'neutral',
              },
              bad: {
                res: { foodStaple: -2 },
                log: '陷阱一个都没响，但米袋上又多了两个洞。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',
            label: '损失不大，先放着',
            effect: {
              res: { foodStaple: -2 },
              addCond: ['dysentery'],
              log: '两天后你损失了更多的粮，而且开始拉肚子。老鼠身上带的东西比它们吃掉的更贵。',
              tone: 'bad',
            },
          },
        ],
      },
      {
        id: 'mold',
        title: '墙角长出了东西',
        body: '一片深绿带黑的斑，从踢脚线往上，大概巴掌大。你昨天还没注意到。\n潮气是从地下来的。擦掉表面很容易，但根在墙里。',
        require: { any: ['site:damp', 'site:underground', 'weather:rain', 'weather:flooding'] },
        choices: [
          {
            id: 'treat',
            label: '铲掉并做防潮处理（2 建材）',
            requires: { res: { materials: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { materials: -2 },
              stats: { stamina: -9 },
              log: '你铲掉墙皮，刷了一层防水涂料，又在墙角摆了两盆生石灰。',
              tone: 'good',
            },
          },
          {
            id: 'wipe',
            label: '擦掉就算了',
            effect: {
              log: '你擦掉了它。一周后它会回来，比现在大三倍。',
              tone: 'neutral',
            },
          },
          {
            id: 'ignore',
            label: '不管',
            effect: {
              addCond: ['moldLung'],
              log: '你没管它。晚上睡觉时你开始觉得吸气有点费劲。',
              tone: 'bad',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_water_find',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 9,
    cooldown: 5,
    variants: [
      {
        id: 'rooftop_tank',
        title: '楼顶的水箱',
        body: '你以前从没上过楼顶。那里有一个不锈钢水箱，是给顶层加压用的，停水那天它应该还是满的。\n盖子是锁着的，锁很旧。里面可能有一吨水，也可能早就被人抽干了。',
        forbid: { any: ['site:underground', 'site:isolated'] },
        choices: [
          {
            id: 'open',
            label: '撬开看看',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { water: 45 },
              stats: { stamina: -14 },
              world: { exposure: 4 },
              log: '锁比水箱先坏。里面有大半箱水，你用桶提了七趟。',
              tone: 'good',
            },
          },
          {
            id: 'quiet',
            label: '悄悄接管子，别让人看见',
            requires: { res: { parts: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -2, water: 38 },
              stats: { stamina: -10 },
              log: '你接了一根软管从楼顶下来，藏在雨水管里。现在只有你知道那箱水的存在。',
              tone: 'good',
            },
          },
          {
            id: 'share',
            label: '告诉楼里其他人',
            effect: {
              res: { water: 20 },
              stats: { humanity: 7, reputation: 8 },
              world: { neighborhood: 18, exposure: 6 },
              log: '你在楼道里喊了一声。七户人家一起分了那箱水，还排了取水的顺序。你分到的少了一半。',
              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'rain_catch',
        title: '要下雨了',
        body: '云压得很低，风向也变了。雨会下，问题是你有没有东西接。\n展开一块防水布能接几十升，但布和绳子都要用建材。',
        require: { any: ['weather:overcast', 'weather:rain', 'weather:storm', 'weather:fog'] },
        choices: [
          {
            id: 'rig',
            label: '搭一套集雨装置（3 建材）',
            requires: { res: { materials: 3 }, ap: 1 },
            effect: {
              ap: -1,
              res: { materials: -3, water: 26 },
              stats: { stamina: -10 },
              setFlags: ['flag:rainCatcher'],
              log: '你把防水布绷成一个漏斗，接到桶里。雨下了一夜，你收了二十六升。',
              tone: 'good',
            },
          },
          {
            id: 'buckets',
            label: '就摆几个桶',
            effect: {
              res: { water: 9 },
              log: '你把所有能用的容器都摆到窗外和阳台。收了九升，还有半桶是脏的。',
              tone: 'neutral',
            },
          },
          {
            id: 'skip',
            label: '不管，储水还够',
            effect: { log: '你没接雨。雨下了整晚，全部流进了下水道。', tone: 'neutral' },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_crew_friction',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 9,
    cooldown: 4,
    require: { any: ['crew:some', 'crew:full'] },
    variants: [
      {
        id: 'ration_argument',
        title: '有人在算你分的粮',
        body: '不是吵架，只是一句话："今天这份好像比昨天少。"\n说完他就没再提了，但屋里安静了几秒。你知道他说得没错。',
        choices: [
          {
            id: 'explain',
            label: '把账本摊开给所有人看',
            check: {
              skill: 'negotiation',
              dc: 10,
              ok: {
                survivor: { morale: 10, trust: 8 },
                stats: { reputation: 4 },
                log: '你把每天的消耗和剩余都写在墙上。看见数字之后，没人再抱怨了——他们开始自己算。',
                tone: 'good',
              },
              bad: {
                survivor: { morale: -6 },
                log: '你解释了很久，但数字反而让气氛更沉。有人说"那我们撑不到下个月啊"。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'give_more',
            label: '今天给足，明天再说',
            effect: {
              res: { foodStaple: -3 },
              survivor: { morale: 12 },
              log: '你多开了三份罐头。今晚屋里有人笑了。',
              tone: 'good',
            },
          },
          {
            id: 'authority',
            label: '把话说清楚：分配由你定',
            effect: {
              survivor: { morale: -8, trust: -4 },
              stats: { humanity: -3, reputation: -2 },
              log: '你说了一句"这里的东西是我的"。没人反驳。那之后的两天，没人主动跟你说话。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'theft',
        title: '少了两份罐头',
        body: '你记得很清楚，昨晚清点是十一份，现在是九份。门没被撬，锁没坏。\n屋里就这么几个人。',
        require: { all: ['crew:some'] },
        choices: [
          {
            id: 'confront',
            label: '当着所有人问',
            check: {
              skill: 'negotiation',
              dc: 12,
              ok: {
                res: { foodStaple: 2 },
                survivor: { trust: 6, morale: -4 },
                log: '一个人低头认了。他说家里还有个孩子在别处。他把东西还了，然后哭了很久。',
                tone: 'neutral',
              },
              bad: {
                survivor: { morale: -12, trust: -8 },
                log: '没有人承认。每个人都在看别人。从今天起这屋里有了一种不会消失的东西。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'lock',
            label: '不说，把仓库锁起来',
            effect: {
              res: { parts: -1 },
              survivor: { morale: -5, trust: -3 },
              setFlags: ['flag:lockedStores'],
              log: '你装了一把锁，钥匙只有一把。没人问那把锁是为谁装的，但所有人都知道。',
              tone: 'neutral',
            },
          },
          {
            id: 'let_go',
            label: '算了，两份而已',
            effect: {
              stats: { humanity: 4, sanity: -3 },
              survivor: { morale: 3 },
              log: '你什么都没说。第二天早上，那两份罐头回来了，就放在原处。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_recruit',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 7,
    cooldown: 7,
    forbid: { all: ['crew:full'] },
    variants: [
      {
        id: 'offer_skills',
        title: '有人拿手艺来换住处',
        body: '"我会修电机，也会焊。"他摊开手给你看——虎口有厚厚的茧，指甲缝里是洗不掉的黑。\n"我不要钱，就要个能睡的地方和一天两顿。"\n多一个人就是多一份口粮、多一点声音，但也是多一双手。',
        choices: [
          {
            id: 'accept',
            label: '收下他',
            effect: {
              survivor: { recruit: 'random' },
              world: { exposure: 4 },
              stats: { sanity: 5 },
              log: '你让他住进了阳台。他第一天就把漏水的接头修好了。',
              tone: 'good',
            },
          },
          {
            id: 'trial',
            label: '让他先干三天活，不进屋',
            effect: {
              res: { foodStaple: -2, materials: 3, parts: 3 },
              stats: { humanity: -2 },
              log: '你让他在楼道里干了三天，管饭不管住。第四天他没来。他留下的活干得很好。',
              tone: 'neutral',
            },
          },
          {
            id: 'refuse',
            label: '这里住不下了',
            effect: {
              stats: { humanity: -3 },
              log: '你说住不下。他点头说理解，问你知不知道别处还有谁在收人。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'family_pair',
        title: '一对母女站在门口',
        body: '女人抱着一个五六岁的孩子，孩子睡着了，脸埋在她肩上。\n"我什么都能做，"她说，"她吃得很少。"\n她说这句话的时候，先看的是孩子。',
        forbid: { all: ['contagion:high'] },
        choices: [
          {
            id: 'accept',
            label: '让她们进来',
            effect: {
              survivor: { recruit: 'lijie' },
              stats: { humanity: 12, sanity: 6 },
              world: { exposure: 5, neighborhood: 8 },
              setFlags: ['flag:tookInFamily'],
              log: '你让她们进来了。孩子醒了之后一直没说话，只是紧紧抓着她妈的袖子。',
              tone: 'good',
            },
          },
          {
            id: 'supplies',
            label: '给她们一些物资，指个方向',
            requires: { res: { foodStaple: 2, water: 4 } },
            effect: {
              res: { foodStaple: -2, water: -4 },
              stats: { humanity: 2, sanity: -4 },
              log: '你给了她们水和罐头，告诉她们体育馆那边有安置点。你不知道那消息是几天前的了。',
              tone: 'neutral',
            },
          },
          {
            id: 'refuse',
            label: '关上门',
            effect: {
              stats: { humanity: -11, sanity: -10 },
              world: { neighborhood: -6 },
              setFlags: ['flag:refusedChild'],
              log: '你关上了门。你听着她的脚步声，还有孩子突然开始的哭声，一直到楼下。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_found_document',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 8,
    cooldown: 5,
    variants: [
      {
        id: 'notebook',
        title: '你捡到了一个笔记本',
        body: '是在楼道的窗台上，被雨打湿了一半。前面几页是购物清单和电话号码。\n从中间开始变成了记录：日期、体温、还剩多少水。\n最后一页只有一行字，字迹很稳："今天听见有人在楼上走路。我很高兴。"\n日期是四天前。这栋楼里没有别人。',
        choices: [
          {
            id: 'keep',
            label: '收好它',
            effect: {
              stats: { sanity: 6, humanity: 3 },
              setFlags: ['flag:hasNotebook'],
              log: '你把笔记本放进了自己的抽屉。有时候知道别人也在数日子，会好受一点。',
              tone: 'neutral',
            },
          },
          {
            id: 'search',
            label: '去楼上找那个人',
            requires: { ap: 1 },
            check: {
              skill: 'stealth',
              dc: 9,
              ok: {
                ap: -1,
                res: { water: 6, meds: 2, foodStaple: 3 },
                stats: { sanity: -8, humanity: 4 },
                log: '你在八楼找到了那间屋子。人已经不在了——门开着，东西还整整齐齐地摆着。你带走了她用不上的部分。',
                tone: 'grim',
              },
              bad: {
                ap: -1,
                stats: { stamina: -12, sanity: -6 },
                log: '你把每一层都敲了一遍，没有人应门。回到自己屋里，你听见楼上有脚步声。',
                tone: 'grim',
              },
            },
          },
          {
            id: 'leave',
            label: '放回窗台',
            effect: {
              stats: { sanity: -3 },
              log: '你把它放回原处，摆得整整齐齐。第二天它不在了。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'wall_writing',
        title: '楼道墙上多了几行字',
        body: '用红色的粉笔写的，字很大，看得出写的人很急。\n"12号 有水 好人"\n"14号 别去"\n"17号 三个人 有枪"\n你住 15 号。你的门牌旁边什么都没写。',
        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'add',
            label: '在自己门牌旁写"有水，可以换东西"',
            effect: {
              world: { exposure: 14, neighborhood: 10 },
              stats: { humanity: 4 },
              faction: { trader: 8 },
              setFlags: ['flag:markedFriendly'],
              log: '你写了。接下来几天会有人来敲门——有些是来换东西的，有些不是。',
              tone: 'neutral',
            },
          },
          {
            id: 'erase',
            label: '把所有字都擦掉',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -10, neighborhood: -5 },
              stats: { stamina: -6 },
              log: '你擦掉了整面墙。有用的信息和危险的信息一起消失了。',
              tone: 'neutral',
            },
          },
          {
            id: 'fake',
            label: '在自己门牌旁写"空 已清"',
            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                world: { exposure: -16 },
                log: '你模仿了那个人的笔迹，还在门上补了一道假的撬痕。之后一周没人敲过你的门。',
                tone: 'good',
              },
              bad: {
                world: { exposure: 6 },
                log: '你写完退后一看，笔迹和别的完全不一样，反而像是在特意标记自己。',
                tone: 'bad',
              },
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_radio_voice',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 8,
    cooldown: 4,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'dj',
        title: '有个人在电台上说话',
        body: '不是通报，是聊天。一个男声，背景里有咖啡杯的声音。\n"……我知道你们能听见。我不知道有多少人，但我每天这个时候都在。"\n他念了几个安全点的坐标，然后放了一首很旧的歌。\n"如果你今天做了一件好事，"他在歌结束后说，"我想让你知道，有人替你记着。"',
        choices: [
          {
            id: 'listen',
            label: '听完',
            effect: {
              stats: { sanity: 9 },
              setFlags: ['flag:knowsDJ'],
              schedule: [{ familyId: 'daily_radio_voice', inDays: 5 }],
              log: '你听完了整段。那首歌你以前不喜欢，现在听着觉得挺好。',
              tone: 'good',
            },
          },
          {
            id: 'call',
            label: '呼叫他',
            requires: { modules: { radio: 2 }, reason: '需要 2 级无线电才能发射' },
            effect: {
              stats: { sanity: 14, reputation: 6 },
              world: { exposure: 8 },
              setFlags: ['flag:talkedToDJ'],
              schedule: [{ familyId: 'daily_dj_mentions', inDays: 3 }],
              log: '你按下发射键说了自己的门牌号和一句"我还在"。他重复了一遍，然后说"收到，十五号"。',
              tone: 'good',
            },
          },
          {
            id: 'note_coords',
            label: '只记下坐标',
            effect: {
              stats: { sanity: 3 },
              setFlags: ['flag:knowsNorthRoute'],
              log: '你把三个坐标抄在了地图边上。最北边那个离这里三百公里。',
              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'numbers',
        title: '一段只有数字的广播',
        body: '女声，机械，每三分钟重复一次同一串数字。\n你听了四遍才发现规律：前六位是日期，中间是一个坐标，最后两位在每次重复时递减。\n从 14 减到 11 用了十二分钟。它在倒计时。',
        require: { all: ['mod:radio>=2'] },
        choices: [
          {
            id: 'decode',
            label: '把坐标记下来',
            effect: {
              stats: { sanity: -5 },
              setFlags: ['flag:knowsNorthRoute', 'flag:numbersStation'],
              log: '坐标指向西北方向的一片山区。倒计时归零之后，广播停了，再没出现过。',
              tone: 'grim',
            },
          },
          {
            id: 'off',
            label: '关掉',
            effect: {
              stats: { sanity: -8 },
              log: '你关掉了收音机，但那串数字在你脑子里又响了很久。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'daily_dj_mentions',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 0,
    variants: [
      {
        id: 'on_air',
        title: '电台里提到了你',
        body: '"十五号今天还在。"\n就这一句，然后是下一个门牌号，再下一个。他在念一份名单，全是回应过他的人。\n"这些人昨天都还在。今天有三个没回。"',
        require: { any: ['flag:talkedToDJ'] },
        choices: [
          {
            id: 'respond',
            label: '再回应一次',
            effect: {
              stats: { sanity: 11, humanity: 3 },
              world: { exposure: 5 },
              schedule: [{ familyId: 'daily_dj_mentions', inDays: 6 }],
              log: '你说了"十五号还在"。这四个字花掉了一点电，但让你多撑了好几天。',
              tone: 'good',
            },
          },
          {
            id: 'silent',
            label: '这次不回，太危险了',
            effect: {
              stats: { sanity: -6 },
              world: { exposure: -4 },
              log: '你没有回应。明天他会念到你的门牌号，然后停顿一下，跳过去。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_fuel_choice',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 8,
    cooldown: 5,
    require: { any: ['temp:cold', 'temp:freezing', 'temp:extreme'] },
    variants: [
      {
        id: 'burn_what',
        title: '燃料不够烧一整夜',
        body: '你算了三遍。按现在的量，要么今晚烧暖，明后天挨冻；要么每晚只烧两小时，三天都难受但都活着。\n屋里还有一些能烧的东西：书、旧家具、地板。烧掉就没有了。',
        choices: [
          {
            id: 'ration_heat',
            label: '每晚只烧两小时',
            effect: {
              stats: { hp: -4, sanity: -5 },
              survivor: { morale: -6 },
              log: '你把炉子的时间掐得很准。屋里最冷的时候是凌晨四点，你没睡着。',
              tone: 'neutral',
            },
          },
          {
            id: 'burn_furniture',
            label: '烧家具',
            effect: {
              res: { fuel: 5, materials: -3 },
              stats: { sanity: -6 },
              log: '你先烧了书架，然后是餐桌的两条腿。火很旺，屋里第一次暖了。',
              tone: 'neutral',
            },
          },
          {
            id: 'burn_all',
            label: '今晚烧足，明天再想办法',
            effect: {
              res: { fuel: -6 },
              stats: { sanity: 8, hp: 3 },
              survivor: { morale: 10 },
              log: '你把炉子开到最大。这一晚是七周以来最舒服的一晚。明天的事明天说。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_order_decay',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 8,
    cooldown: 5,
    require: { any: ['order:failing', 'order:collapsed', 'order:strained'] },
    variants: [
      {
        id: 'gunshots',
        title: '两个街口外有枪声',
        body: '三下，间隔很短，然后是很长的安静。\n不是猎枪的声音。之后有车启动，开走了。\n二十分钟后，同一个方向又响了一下，只有一下。',
        choices: [
          {
            id: 'stay',
            label: '关灯，不动',
            effect: {
              world: { exposure: -6 },
              stats: { sanity: -5 },
              log: '你关掉所有灯，坐在离窗最远的地方。什么也没发生。',
              tone: 'neutral',
            },
          },
          {
            id: 'look',
            label: '天亮后去看看',
            requires: { ap: 1 },
            check: {
              skill: 'stealth',
              dc: 11,
              ok: {
                ap: -1,
                res: { ammo: 4, foodStaple: 3, parts: 2 },
                stats: { sanity: -10, humanity: -4 },
                log: '两个人躺在便利店门口，货架已经被清过一遍，但他们的背包还在。你拿了背包。',
                tone: 'grim',
              },
              bad: {
                ap: -1,
                stats: { hp: -12, sanity: -12 },
                world: { exposure: 10 },
                log: '你还没走到街口就被人看见了。他们没开枪，只是看着你，一直到你退回去。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'fortify',
            label: '连夜再加固一遍门',
            requires: { res: { materials: 2 } },
            effect: {
              res: { materials: -2 },
              stats: { stamina: -10 },
              world: { exposure: -3 },
              log: '你在门后又加了两根顶杆，把走廊的杂物堆成了障碍。你没睡。',
              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'body_in_street',
        title: '街对面有个人躺了两天了',
        body: '第一天你以为他在睡觉。第二天你看清了姿势。\n没有人去动他。这条街上还剩下的那几户人家，窗帘都是拉着的。\n天气还不算太冷。这件事会变成一个卫生问题。',
        require: { any: ['order:collapsed', 'order:failing'] },
        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'bury',
            label: '和邻居一起处理',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -16, sanity: -8, humanity: 8, reputation: 6 },
              world: { neighborhood: 16, contagion: -3 },
              log: '你和另外两户人家一起把他搬到了小区花园，挖了坑。有人念了几句，没人知道他叫什么。',
              tone: 'grim',
            },
          },
          {
            id: 'alone',
            label: '自己去处理',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -20, sanity: -12, humanity: 6 },
              world: { contagion: -2, exposure: 4 },
              log: '你一个人干完了。回来之后你把外套烧了，洗了四遍手，还是觉得洗不干净。',
              tone: 'grim',
            },
          },
          {
            id: 'ignore',
            label: '不管',
            effect: {
              stats: { sanity: -7, humanity: -5 },
              world: { contagion: 5 },
              log: '你拉上了窗帘。一周后那个位置的气味会让你后悔这个决定。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_quiet_day',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    baseWeight: 7,
    cooldown: 6,
    forbid: { any: ['exposure:marked', 'exposure:hunted'] },
    variants: [
      {
        id: 'nothing_happened',
        title: '今天什么也没发生',
        body: '没有人敲门，没有枪声，天气也还行。\n你把储物间重新整理了一遍，把标签写得更清楚，还找到了一包一直以为丢了的挂面。\n傍晚的时候你坐在窗边，看了很久对面楼的影子。',
        choices: [
          {
            id: 'organize',
            label: '把所有东西重新清点一遍',
            effect: {
              res: { foodStaple: 2, parts: 1 },
              stats: { sanity: 7 },
              log: '你清点出了两份被压在最底下的罐头和一小袋螺丝。整理本身也让人安定。',
              tone: 'good',
            },
          },
          {
            id: 'practice',
            label: '练点东西',
            effect: {
              skills: { mechanics: 1 },
              stats: { stamina: -6, sanity: 4 },
              log: '你把坏掉的收音机拆了又装了三遍。第三遍的时候它响了。',
              tone: 'good',
            },
          },
          {
            id: 'rest',
            label: '什么都不做',
            effect: {
              stats: { stamina: 16, sanity: 10 },
              log: '你睡了一个下午。醒来的时候天还没黑，这让你觉得很富有。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'daily_pet_moment',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    baseWeight: 7,
    cooldown: 6,
    require: { all: ['hasPet'] },
    variants: [
      {
        id: 'dog_warns',
        title: '狗一直在盯着门',
        body: '它没有叫，只是站在门口，耳朵朝前，尾巴平着。已经十分钟了。\n你什么也没听见。但它听见了。',
        choices: [
          {
            id: 'trust',
            label: '相信它，做好准备',
            effect: {
              world: { exposure: -8 },
              stats: { stamina: -6 },
              setFlags: ['flag:dogWarning'],
              log: '你关了灯，拿了工具站在门后。四十分钟后，楼道里有人走过去，停了一下，然后走了。',
              tone: 'good',
            },
          },
          {
            id: 'ignore',
            label: '它只是紧张',
            effect: {
              world: { exposure: 5 },
              log: '你摸了摸它的头就去睡了。第二天早上，门上多了一道新的划痕。',
              tone: 'bad',
            },
          },
        ],
      },
      {
        id: 'dog_food',
        title: '狗粮吃完了',
        body: '它现在吃你的那一份。它吃得不多，但"不多"每天都在累积。\n它看着你的时候不知道这些。它只知道你回来了。',
        require: { any: ['food:low'] },
        choices: [
          {
            id: 'share',
            label: '分自己的口粮给它',
            requires: { res: { foodStaple: 1 } },
            effect: {
              res: { foodStaple: -1 },
              stats: { sanity: 8, humanity: 5, hp: -2 },
              log: '你把自己那份分了一半给它。它吃完了还舔了一遍碗。',
              tone: 'good',
            },
          },
          {
            id: 'release',
            label: '放它出去自己找吃的',
            effect: {
              stats: { sanity: -10, humanity: -4 },
              clearFlags: ['flag:hasPet', 'flag:petDog'],
              log: '你早上开了门，它出去了。晚上你等到很晚，没有再关门。它没有回来。',
              tone: 'grim',
            },
          },
          {
            id: 'grim',
            label: '你已经三天没有真正吃饱了',
            requires: { tags: { all: ['humanity:low'] }, reason: '你还做不到这一步' },
            effect: {
              res: { foodFresh: 6 },
              stats: { sanity: -25, humanity: -20 },
              clearFlags: ['flag:hasPet', 'flag:petDog'],
              setFlags: ['flag:crossedLine'],
              log: '这一天的事你不会写进日记。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  },
];
