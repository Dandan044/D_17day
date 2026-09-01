import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/**
 * 净水相关即时事件：雨雪接水、旱天回用、滤芯与心理。
 * 强度压在 1–2，不发重病。
 */
export const FILTER_BEAT_EVENTS: EventFamily[] = [
  beat({
    id: 'filter_first_recycle',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 11,
    require: { all: ['water:recycling'], none: ['weather:precip'] },
    title: '你烧开了一壶回用水',
    body: '你把壶从炉子上拿下来。水是清的，热气也正常。\n这水是回用滤出来的。拧开盖时屋里只有你一个人。',
    choices: [
      ch(
        'keep',
        '继续滤，照喝',
        {
          stats: { sanity: -4, humanity: -1 },
          log: '你喝了。没有怪味，你还是想起它从哪来的。',
          tone: 'grim',
        },
      ),
      ch(
        'dump',
        '倒掉，今天改限水',
        {
          stats: { sanity: 2 },
          log: '水进了马桶。喉咙干着，你把自己骂了一句。',
          tone: 'neutral',
        },
      ),
      skip('你把壶放回炉子，先不喝。', { stats: { sanity: -2 } }),
    ],
  }),

  beat({
    id: 'filter_ammonia_rim',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['water:recycling', 'mod:filter>=1'] },
    title: '壶口内侧结了一圈白盐',
    body: '壶口内侧有一圈细白盐。凑近闻，有一点氨味。\n水看起来还是清的。你把壶放下，又拿起来。',
    choices: [
      ch(
        'refilter',
        '再滤一遍',
        {
          stats: { stamina: -8, sanity: 2 },
          log: '你又过了一遍滤芯。壶沿那圈白还在，味道淡了。',
          tone: 'good',
        },
      ),
      ch(
        'drink_anyway',
        '照喝',
        {
          stats: { sanity: -3 },
          addCond: ['dysentery'],
          log: '你喝了半杯。下午跑了两趟卫生间。',
          tone: 'bad',
        },
      ),
      skip('你把壶盖上，今天先不碰。', { stats: { stamina: -2 } }),
    ],
  }),

  beat({
    id: 'filter_yellow_rain',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    weight: 9,
    cooldown: 10,
    require: { all: ['weather:precip', 'mod:filter=1'] },
    title: '雨水发黄',
    body: '接水盆底沉着一层细沙。水本身偏黄，像泡过茶。\n滤芯在滴。杯底也有一点沙。',
    choices: [
      ch(
        'keep',
        '照接',
        {
          res: { water: 2 },
          wear: { filterLife: -1 },
          stats: { sanity: -2 },
          log: '你多接了两升。杯子里还有沙，你假装没看见。',
          tone: 'neutral',
        },
      ),
      ch(
        'dump',
        '倒掉今天的',
        {
          res: { water: -4 },
          stats: { sanity: 1 },
          log: '黄水进了下水道。桶里又空了一截。',
          tone: 'grim',
        },
        { requires: { res: { water: 4 } } },
      ),
      skip('你把盆挪开，今天不接了。', { stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_core_brown',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { all: ['mod:filter>=1', 'wear:filterLife<=8'] },
    title: '滤芯褐了一圈',
    body: '你拆开外壳。滤芯外圈已经褐了，捏一下会掉渣。\n按说明书早该换。零件匣里还剩几颗螺丝。',
    choices: [
      ch(
        'swap',
        '立刻换芯（2 零件 + 1 AP）',
        {
          ap: -1,
          res: { parts: -2 },
          wear: { filterLife: 20 },
          stats: { stamina: -6, sanity: 3 },
          log: '新芯就位。出水清了一点。旧芯扔进垃圾袋，袋子鼓着。',
          tone: 'good',
        },
        { requires: { res: { parts: 2 }, ap: 1 } },
      ),
      ch(
        'stretch',
        '再撑几天',
        {
          wear: { filterLife: -2 },
          stats: { sanity: -2 },
          log: '你把外壳拧回去。滴水声没变。',
          tone: 'grim',
        },
      ),
      skip('你盖上盖子，假装没拆开过。', { stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_black_rain_rim',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    weight: 10,
    cooldown: 10,
    require: { all: ['weather:blackRain', 'mod:filter>=1'] },
    title: '黑雨落在盆沿',
    body: '雨点砸在铁盆边上，留下深灰的痕迹。\n滤芯在响。你知道接下来会有水，也知道滤芯会短一截。',
    choices: [
      ch(
        'catch',
        '接',
        {
          res: { water: 5 },
          wear: { filterLife: -2 },
          world: { radiation: 1 },
          stats: { sanity: -2 },
          log: '你接了五升。盆沿的灰用手擦不掉。',
          tone: 'neutral',
        },
      ),
      ch(
        'skip_rain',
        '不接',
        {
          stats: { sanity: 1 },
          log: '你把盆翻过来。雨继续下，桶没动。',
          tone: 'good',
        },
      ),
      skip('你站在窗边看了很久，什么都没做。', { stats: { stamina: -2 } }),
    ],
  }),

  beat({
    id: 'filter_clear_out',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 16,
    require: { all: ['weather:precip', 'mod:filter>=3'] },
    title: '三级滤芯的出水几乎没有味道',
    body: '三级滤芯的出水几乎没有味道。你接满一壶，对着灯看，清得像以前的自来水。\n楼下有人在楼道里走动。',
    choices: [
      ch(
        'extra',
        '多接一盆',
        {
          res: { water: 4 },
          world: { exposure: 3 },
          stats: { stamina: -4 },
          log: '你多接了一盆。楼道里脚步停了一下，又走了。',
          tone: 'good',
        },
      ),
      ch(
        'share',
        '给楼下留一瓶',
        {
          res: { water: -2 },
          stats: { humanity: 4, sanity: 3 },
          world: { neighborhood: 4, exposure: 2 },
          log: '你把瓶子放在对门脚垫上，敲了两下门就回来。',
          tone: 'good',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip('你盖上盖子，够用就行。', { stats: { sanity: 1 } }),
    ],
  }),

  beat({
    id: 'filter_taste_gone',
    kind: 'moral',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['water:recycling', 'mod:filter>=2'] },
    title: '滤掉味道之后你多喝了几口',
    body: '二级滤芯把那股味道拿掉了。你连着喝了三口，才想起今天喝的是回用水。\n壶比早上轻了一截。',
    choices: [
      ch(
        'more',
        '再喝一点',
        {
          res: { water: -2 },
          stats: { sanity: -2 },
          addCond: ['dysentery'],
          log: '你又喝了半杯。夜里肚子不听话。',
          tone: 'bad',
        },
        { requires: { res: { water: 2 } } },
      ),
      ch(
        'ration',
        '按量停手',
        {
          stats: { sanity: 2 },
          log: '你把壶盖上。嘴里还想喝，手没动。',
          tone: 'good',
        },
      ),
      skip('你把壶推远一点。', { stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_half_basin',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 10,
    require: { all: ['water:stored:low'], none: ['weather:precip'] },
    title: '储水桶只剩半盆',
    body: '储桶水面离标记线还有一指。外面没下雨。\n你盯着水位线，算今天还能分几杯。',
    choices: [
      ch(
        'limit',
        '今天限水',
        {
          stats: { sanity: -2, stamina: -4 },
          log: '你把用水档拧低。嘴里发干，桶里的线没怎么动。',
          tone: 'neutral',
        },
      ),
      ch(
        'normal',
        '照常喝',
        {
          res: { water: -2 },
          stats: { sanity: 1 },
          log: '你照常接了两杯。水位线往下缩了一截。',
          tone: 'grim',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip('你盖上桶盖，先不去看。', { stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_tank_full',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { all: ['weather:precip', 'mod:filter>=2'] },
    title: '储水桶满了，溢流口在滴',
    body: '浮球顶住了。滤芯还在滴，水从溢流口往下淌。\n储水已经到顶。继续开只会多耗滤芯。',
    choices: [
      ch(
        'stop',
        '停机',
        {
          wear: { filterLife: 1 },
          stats: { sanity: 2 },
          log: '你关掉泵。溢流停了。桶沿还在湿。',
          tone: 'good',
        },
      ),
      ch(
        'give',
        '给邻居分一点',
        {
          res: { water: -6 },
          stats: { humanity: 5, reputation: 3, sanity: 3 },
          world: { neighborhood: 6, exposure: 4 },
          log: '你灌了两瓶放到楼道。有人拿走了一瓶，留了张纸条：谢。',
          tone: 'good',
        },
        { requires: { res: { water: 6 } } },
      ),
      skip('你让它溢了一会儿，再关。', { wear: { filterLife: -1 }, stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_puddle_scoop',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['site:urban'], none: ['weather:precip', 'mod:filter>=1'] },
    title: '井盖边的积水',
    body: '楼道拐角井盖边积了一洼水，表面有油膜。\n桶里快空了。你蹲下来，手里拿着空瓶。',
    choices: [
      ch(
        'boil',
        '舀来烧开了喝',
        {
          res: { water: 3, fuel: -0.5 },
          stats: { stamina: -6 },
          addCond: ['dysentery'],
          log: '你烧开了。水还是浑。夜里肚子先抗议。',
          tone: 'bad',
        },
        { requires: { res: { fuel: 0.5 } } },
      ),
      ch(
        'leave',
        '不喝',
        {
          stats: { sanity: 1, stamina: -2 },
          log: '你站起来，空瓶塞回口袋。油膜还在晃。',
          tone: 'good',
        },
      ),
      skip('你看了很久，最后走开。', { stats: { sanity: -2 } }),
    ],
  }),
];
