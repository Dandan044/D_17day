import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { APT, HIGH, NUC } from './queries';

/**
 * 核战 × 公寓：建筑模块门槛 + 资源平替。
 * 有模块走轻后果；没模块耗物资硬扛；再不行走惩罚。
 */
export const NUKE_BUILD_CHECK_EVENTS: EventFamily[] = [
  // ---------- 撬门：试顶杆 → 再来 / 门框松 → 换锁 ----------
  beat({
    id: 'nuke_build_pry_1',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: APT,
    minThreat: 2,
    title: '门外有人在试你的顶杆',
    body: '金属碰门框，一下、两下。不是钥匙，是撬棍一类的东西。\n猫眼里两个人影。一个蹲着，一个望着楼梯口。',
    choices: [
      ch(
        'hold_door',
        '靠现有加固顶住，不出声',
        {
          stats: { stamina: -8, sanity: 2 },
          world: { exposure: -2 },
          setFlags: ['flag:pryHeldByFortify'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 2 }],
          log: '门动了一下，顶杆咬住。外面骂了句什么，下楼了。',
          tone: 'good',
        },
        { requires: { modules: { fortify: 1 }, reason: '需要加固 1 级' } },
      ),
      ch(
        'brace',
        '用建材把冰箱和门再顶死',
        {
          res: { materials: -2 },
          stats: { stamina: -14 },
          setFlags: ['flag:pryBraced'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 2 }],
          log: '木材卡进门缝。外面又撞了两下，停了。你的手在发抖。',
          tone: 'neutral',
        },
        { requires: { res: { materials: 2 } } },
      ),
      ch(
        'warn_shot',
        '朝门板上方开一枪',
        {
          res: { ammo: -1 },
          stats: { sanity: -6, humanity: -2 },
          world: { exposure: 12 },
          setFlags: ['flag:pryGunshot', 'flag:gunshotRecent', 'flag:firedWarning'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 1 }],
          log: '枪声在楼道里滚了一圈。脚步声跑得很快。整栋楼都听见了。',
          tone: 'grim',
        },
        { requires: { res: { ammo: 1 } } },
      ),
      skip('你贴着墙，不吭声。试了第四下，他们走了。', {
        stats: { sanity: -8 },
        world: { exposure: 8 },
        setFlags: ['flag:pryEndured'],
        schedule: [{ familyId: 'nuke_build_pry_2', inDays: 1 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_pry_2',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:pryHeldByFortify', 'flag:pryBraced', 'flag:pryGunshot', 'flag:pryEndured'],
    },
    title: '同一拨人又上来了，门框已经有点松',
    body: '螺丝眼周围的漆掉了一圈。他们换了根更粗的棍子。\n其中一个说："上次没弄开，今天弄开。"',
    choices: [
      ch(
        'fort2',
        '靠加固二级结构死顶',
        {
          stats: { stamina: -10 },
          world: { exposure: -4 },
          setFlags: ['flag:pryRepelledHard'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 3 }],
          log: '门斗咬死。棍子断了一截。他们骂着下楼，有人踢了你的门一脚泄愤。',
          tone: 'good',
        },
        { requires: { modules: { fortify: 2 }, reason: '需要加固 2 级' } },
      ),
      ch(
        'repair_brace',
        '再耗建材把框钉死',
        {
          res: { materials: -3, parts: -1 },
          stats: { stamina: -16 },
          setFlags: ['flag:pryRepaired'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 4 }],
          log: '你钉到手腕发麻。外面又撞了一次，撞不动，走了。',
          tone: 'neutral',
        },
        { requires: { res: { materials: 3, parts: 1 } } },
      ),
      ch(
        'lose_stuff',
        '撑不住，从门缝塞出一点物资换他们走',
        {
          res: { foodStaple: -3, water: -6 },
          stats: { sanity: -6 },
          world: { exposure: 6 },
          shelter: { fortify: -1 },
          setFlags: ['flag:pryBoughtOff'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 2 }],
          log: '物资被拖走。门框又松了一扣。你听见他们在下一层笑。',
          tone: 'bad',
        },
        { requires: { res: { foodStaple: 3, water: 6 } } },
      ),
      skip('门开了一条缝。你用身体堵住。他们伸手抓了两样就跑。', {
        res: { foodStaple: -2, meds: -1 },
        stats: { hp: -8, stamina: -12, sanity: -8 },
        shelter: { fortify: -1 },
        world: { exposure: 10 },
        setFlags: ['flag:pryBreached'],
        schedule: [{ familyId: 'nuke_build_pry_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_pry_3',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:pryRepelledHard', 'flag:pryRepaired', 'flag:pryBoughtOff', 'flag:pryBreached'],
    },
    title: '锁芯周围全是金属屑',
    body: '门还能关。锁转起来发涩。楼道墙上有人用粉笔画了个箭头，指向你家。\n箭头可以擦掉。锁芯的涩感擦不掉。',
    choices: [
      ch(
        'new_core',
        '拆锁芯换一套',
        {
          res: { parts: -2 },
          stats: { stamina: -10, sanity: 3 },
          world: { exposure: -2 },
          log: '新锁芯咬合时咔哒一声。你把旧的扔进垃圾桶，盖严。',
          tone: 'good',
        },
        { requires: { res: { parts: 2 } } },
      ),
      ch('erase_arrow', '把墙上的箭头擦掉', {
        stats: { stamina: -4 },
        world: { exposure: -3 },
        log: '粉灰沾在袖子上。箭头没了。你知道他们记得门牌。',
        tone: 'neutral',
      }),
      skip('你在门后加了一根棍子。锁暂时不换。', {
        stats: { sanity: -3 },
      }),
    ],
  }),

  // ---------- 楼道灌烟：堵缝 → 烟散 ----------
  beat({
    id: 'nuke_build_smoke_1',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,
    minThreat: 2,
    title: '楼道有烟往你门缝里钻',
    body: '不是做饭的油烟。有塑料味，刺嗓子。猫眼里白茫茫一片。\n楼下有人喊："谁家着了？"没有人应。',
    choices: [
      ch(
        'seal_fort',
        '靠门缝密封顶住',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { airPollution: -2 },
          setFlags: ['flag:smokeSealedFort'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
          log: '加固过的门缝几乎不进烟。你仍用湿布捂了鼻子，等到楼道安静。',
          tone: 'good',
        },
        { requires: { modules: { fortify: 1 }, reason: '需要加固 1 级' } },
      ),
      ch(
        'seal_insulate',
        '靠保温层把缝压死',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { airPollution: -2 },
          setFlags: ['flag:smokeSealedInsulate'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
          log: '保温条咬住门缝。屋里烟味淡了一截。你坐在地上喘。',
          tone: 'good',
        },
        { requires: { modules: { insulate: 1 }, reason: '需要保温 1 级' } },
      ),
      ch(
        'tape_gap',
        '用建材和胶带把缝糊上',
        {
          res: { materials: -2 },
          stats: { stamina: -10 },
          setFlags: ['flag:smokeTaped'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
          log: '胶带一层层叠上去。手指发黑。烟少了，屋里更闷。',
          tone: 'neutral',
        },
        { requires: { res: { materials: 2 } } },
      ),
      ch(
        'wet_cloth',
        '湿布顶门缝，人退到卫生间',
        {
          res: { water: -2 },
          stats: { stamina: -8, sanity: -3, hp: -2 },
          setFlags: ['flag:smokeCloth'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
          log: '布很快干热。你咳了几声。烟还是进来了一点。',
          tone: 'grim',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip('你把窗开一条缝换气。外面的灰和楼道的烟一起进来。', {
        stats: { hp: -4, sanity: -6 },
        world: { radiation: 3, airPollution: 6, exposure: 4 },
        setFlags: ['flag:smokeOpenedWindow'],
        schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_smoke_2',
    kind: 'medical',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: [
        'flag:smokeSealedFort',
        'flag:smokeSealedInsulate',
        'flag:smokeTaped',
        'flag:smokeCloth',
        'flag:smokeOpenedWindow',
      ],
    },
    title: '烟散了，门缝里留着一圈黑印',
    body: '楼道墙上有熏痕。你家门垫边上像被火燎过。\n嗓子还痒。水烧开了，你还是不敢大口喝。',
    choices: [
      ch(
        'scrub',
        '用水把黑印擦掉',
        {
          res: { water: -3 },
          stats: { stamina: -8, sanity: 2 },
          log: '印淡了。抹布扔进垃圾袋，扎紧。',
          tone: 'good',
        },
        { requires: { res: { water: 3 } } },
      ),
      ch(
        'meds_throat',
        '吃药压嗓子',
        {
          res: { meds: -1 },
          stats: { hp: 3, sanity: 2 },
          log: '药很苦。咳停了一阵。你把窗户仍然关死。',
          tone: 'good',
        },
        { requires: { res: { meds: 1 } } },
      ),
      skip('你留着黑印当提醒。夜里还是咳了两声。', {
        stats: { sanity: -4, hp: -3 },
        addCond: ['coPoisoning'],
      }),
    ],
  }),

  // ---------- 浑水：滤 / 烧 / 硬喝 → 滤芯或锈味 → 分桶 ----------
  beat({
    id: 'nuke_build_murky_1',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: NUC,
    title: '桶里的水隔夜发浑，底下有细沙',
    body: '你摇了摇。沙转起来，像有人往里撒过灰。盖子是盖的。\n旁边那桶还清。你不确定要不要混着喝。',
    choices: [
      ch(
        'run_filter',
        '开净水机滤一遍',
        {
          wear: { filterLife: -1 },
          stats: { stamina: -4, sanity: 3 },
          setFlags: ['flag:murkyFiltered'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 2 }],
          log: '机子嗡了一会儿。出水清了些。滤芯指示往黄区偏了一格。',
          tone: 'good',
        },
        { requires: { modules: { filter: 1 }, reason: '需要净水 1 级' } },
      ),
      ch(
        'boil',
        '烧开再晾',
        {
          res: { fuel: -1, water: -1 },
          stats: { stamina: -8 },
          setFlags: ['flag:murkyBoiled'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 2 }],
          log: '壶底多了一层灰。水凉了还能喝，有一点锈味。',
          tone: 'neutral',
        },
        { requires: { res: { fuel: 1 } } },
      ),
      ch(
        'drink_raw',
        '浑的也喝，省燃料',
        {
          stats: { hp: -4, sanity: -3 },
          setFlags: ['flag:murkyDrunkRaw'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 1 }],
          log: '你喝了半杯。沙子硌牙。胃里过了一会儿才安静。',
          tone: 'bad',
        },
      ),
      skip('你把浑水单放，先喝清的。', {
        stats: { sanity: 1 },
        setFlags: ['flag:murkyIsolated'],
        schedule: [{ familyId: 'nuke_build_murky_2', inDays: 3 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_murky_2',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:murkyFiltered', 'flag:murkyBoiled', 'flag:murkyDrunkRaw', 'flag:murkyIsolated'],
    },
    title: '水还是有锈味，滤芯指示已经偏红',
    body: '你拧开端盖看了一眼：泥糊在褶皱里。说明书上的更换天数你早过了。\n烧开的那壶，凉了以后杯壁仍有一圈黄。',
    choices: [
      ch(
        'filter2',
        '用二级净水再压一遍',
        {
          wear: { filterLife: -2 },
          stats: { sanity: 3 },
          setFlags: ['flag:murkyDeepFiltered'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 3 }],
          log: '出水终于不黄了。机子比平时响。你记下该换芯。',
          tone: 'good',
        },
        { requires: { modules: { filter: 2 }, reason: '需要净水 2 级' } },
      ),
      ch(
        'replace_core',
        '换滤芯',
        {
          res: { parts: -1 },
          wear: { filterLife: 14 },
          stats: { stamina: -8 },
          setFlags: ['flag:murkyReplacedCore'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 3 }],
          log: '旧芯扔进袋里，扎紧。水流清了一点，锈味还在记忆里。',
          tone: 'good',
        },
        { requires: { res: { parts: 1 } } },
      ),
      ch(
        'keep_boil',
        '继续烧，不换芯',
        {
          res: { fuel: -1.5, water: -2 },
          stats: { stamina: -6, sanity: -2 },
          setFlags: ['flag:murkyKeepBoil'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 2 }],
          log: '燃料少了一截。水能喝。你开始讨厌烧水声。',
          tone: 'neutral',
        },
        { requires: { res: { fuel: 2 } } },
      ),
      skip('你照喝。夜里跑了两趟卫生间。', {
        stats: { hp: -6, stamina: -10, sanity: -4 },
        addCond: ['dysentery'],
        setFlags: ['flag:murkySick'],
        schedule: [{ familyId: 'nuke_build_murky_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_murky_3',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: [
        'flag:murkyDeepFiltered',
        'flag:murkyReplacedCore',
        'flag:murkyKeepBoil',
        'flag:murkySick',
      ],
    },
    title: '你开始给水桶贴标签',
    body: '清的、待滤的、只洗手的。字写得很小。\n贴完标签，你知道哪桶能喝、哪桶只能洗手。',
    choices: [
      ch('label_all', '三桶都贴上，分开放', {
        stats: { sanity: 4, stamina: -4 },
        log: '清的靠里，浑的靠门。你进出时不再拿错。',
        tone: 'good',
      }),
      ch(
        'dump_half',
        '倒掉半桶最浑的',
        {
          res: { water: -6 },
          stats: { sanity: 2 },
          log: '水从马桶走。你听着冲下去，心口松一点，又紧一点。',
          tone: 'neutral',
        },
        { requires: { res: { water: 6 } } },
      ),
      skip('你写了两张就停了。第三桶暂时空着。', {
        stats: { sanity: -1 },
      }),
    ],
  }),

  // ---------- 滤芯崩裂（需已有净水） ----------
  beat({
    id: 'nuke_build_filter_crack',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: { all: ['disaster:nuclear', 'mod:filter>=1'] },
    title: '净水机外壳裂了一道，里面在滴',
    body: '你是听见滴在盆里的声音才发现的。裂缝不长，但在渗。\n水箱还剩大半。关掉，还是凑合用到换芯。',
    choices: [
      ch(
        'swap_now',
        '立刻换芯并堵住裂缝',
        {
          res: { parts: -2, materials: -1 },
          wear: { filterLife: 16 },
          stats: { stamina: -12, sanity: 3 },
          log: '新芯就位。裂缝用胶糊住。滴水停了。地上湿了一片。',
          tone: 'good',
        },
        { requires: { res: { parts: 2, materials: 1 } } },
      ),
      ch(
        'downgrade',
        '降级凑合用，盆接着漏',
        {
          shelter: { filter: -1 },
          wear: { filterLife: -4 },
          stats: { sanity: -3 },
          world: { exposure: 2 },
          log: '你把档位拧低。漏慢了。有效过滤也弱了。盆要天天倒。',
          tone: 'grim',
        },
      ),
      ch(
        'shut_boil',
        '关掉机器，改烧水',
        {
          shelter: { filter: -1 },
          res: { fuel: -0.5 },
          stats: { stamina: -4 },
          log: '机子安静了。你把壶放上。以后水要按顿算燃料。',
          tone: 'neutral',
        },
      ),
      skip('你用胶带缠了两圈。还在滴，只是更慢。', {
        wear: { filterLife: -3 },
        stats: { sanity: -2, hp: -2 },
      }),
    ],
  }),

  // ---------- 空调孔灌灰 ----------
  beat({
    id: 'nuke_build_ac_vent',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,
    title: '空调孔往屋里灌灰',
    body: '外机早停了。孔洞用泡沫堵过，泡沫缩了。\n窗台上那圈灰是细的，一吹就起来。你咳嗽的时候，灰在光柱里转。',
    choices: [
      ch(
        'insulate_block',
        '靠保温层把孔压死',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { radiation: -1 },
          log: '孔堵住了。屋里少了一条风。灰不再从那里进。',
          tone: 'good',
        },
        { requires: { modules: { insulate: 1 }, reason: '需要保温 1 级' } },
      ),
      ch(
        'stuff_materials',
        '塞建材和湿布',
        {
          res: { materials: -1, water: -1 },
          stats: { stamina: -8 },
          world: { radiation: -0.5 },
          log: '布很快变黑。你又加了一层。孔暂时不漏了。',
          tone: 'neutral',
        },
        { requires: { res: { materials: 1, water: 1 } } },
      ),
      skip('你用塑料袋缠了两圈。风大时袋子会鼓。', {
        stats: { sanity: -3, hp: -2 },
        world: { radiation: 2 },
      }),
    ],
  }),

  // ---------- 停电与药品/生鲜 ----------
  beat({
    id: 'nuke_build_fridge_dark',
    kind: 'opportunity',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: APT,
    title: '冰箱不响了，箱门一开就是热气',
    body: '灯不亮。里面的退烧药盒子上起了汗。生鲜那格已经软了。\n你还有一小罐油，和一排电池。药怕热。',
    choices: [
      ch(
        'keep_power',
        '靠供电把冷藏保一阵',
        {
          stats: { stamina: -4, sanity: 2 },
          wear: { batteryCharge: -4 },
          log: '机子又哼起来。箱里凉了一点。你把药挪到最里面。',
          tone: 'good',
        },
        { requires: { modules: { power: 1 }, reason: '需要发电 1 级' } },
      ),
      ch(
        'gen_fuel',
        '烧燃料开小电机充一会',
        {
          res: { fuel: -2 },
          wear: { batteryCharge: 6, generatorOil: -1 },
          stats: { stamina: -8 },
          world: { exposure: 4 },
          log: '电机在楼道里也听得见。你充了两小时，把药抢凉。',
          tone: 'neutral',
        },
        { requires: { res: { fuel: 2 } } },
      ),
      ch(
        'move_cool',
        '药挪到阴凉处，生鲜今晚吃掉',
        {
          res: { foodFresh: -2 },
          stats: { stamina: -4, sanity: -2 },
          log: '你把药塞进衣柜底层。生鲜煮了一锅，咸，但没浪费。',
          tone: 'grim',
        },
        { requires: { res: { foodFresh: 2 } } },
      ),
      skip('你关上门假装没这回事。第二天药盒潮了，生鲜只能扔。', {
        res: { foodFresh: -3, meds: -1 },
        stats: { sanity: -4 },
      }),
    ],
  }),
];
