import type { EventFamily } from '../../types';
import { beat } from './factory';
import { URBAN } from './queries';

/**
 * 生存期事件（崩溃日之后）。
 *
 * 这个文件是"事件家族 + 变体"机制的主要展示面：
 * raid_attempt 只写了一次，但洪灾局是有人划艇撬二楼窗，
 * 核战局是巡逻队以战时征收的名义清点物资，
 * 地下站点是有人在通风井上方喊话威胁灌汽油。
 * 合理性由 require/forbid 标签保证，而不是靠作者记住所有组合。
 */
export const SURVIVAL_EVENTS: EventFamily[] = [
beat({
    id: 'pressure_passerby',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：不带任何条件，保证这一档永远有内容
        id: 'beggar',
        title: '有人敲门，只敲了三下',
        body: '很轻，像是怕吵到别人。门外是一个人，很瘦，穿着还算干净的外套。\n"我不进来，"他说，"能给点水吗？半瓶就行。"',
        choices: [
          {
            id: 'give',
            label: '递出去一瓶水',
            requires: { res: { water: 2 } },
            effect: {
              res: { water: -2 },
              stats: { humanity: 4 },
              world: { exposure: 4, neighborhood: 3 },
              log: '你从门缝里递出去一瓶水。他说了谢谢，走了。现在有人知道这里有水。',
              tone: 'neutral',
            },
          },
          {
            id: 'silent',
            label: '不出声，等他走',
            effect: {
              stats: { humanity: -3, sanity: -3 },
              log: '你贴着门站了十分钟，直到脚步声下了楼。你的腿有点麻。',
              tone: 'grim',
            },
          },
          {
            id: 'info',
            label: '告诉他哪里有积水可以取',
            effect: {
              stats: { humanity: 2 },
              world: { exposure: 2 },
              log: '你隔着门告诉他小学操场的储水箱还有水。他谢了你。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'distant_figure',
        title: '路上停了一辆车，很久没走',
        body: '离这里大概八百米，就停在进来的那条土路上。没有人下来。\n一个小时后它掉头走了。你在望远镜里看见副驾驶座上有人一直在看这个方向。',
        require: { any: ['site:isolated', 'site:elevated'] },
        choices: [
          {
            id: 'hide_tracks',
            label: '把院子里的痕迹和烟囱的烟都处理掉',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -12 },
              stats: { stamina: -10 },
              log: '你把车辙扫平，把烟囱改成了贴地排烟。这个地方从路上看起来又空了。',
              tone: 'good',
            },
          },
          {
            id: 'watch',
            label: '什么都不做，继续观察',
            effect: {
              world: { exposure: 4 },
              log: '你记下了车牌的后三位。第二天同一时间，它又来了。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'vent_voice',
        title: '通风井里传来说话声',
        body: '不是对你说的。两个人在上面聊天，声音顺着管道下来，听得很清楚。\n"这下面以前是停车场吧。"\n"锁着呢。"\n"锁着不代表没人。"',
        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'silent',
            label: '关掉一切声源，屏住呼吸',
            effect: {
              world: { exposure: -8 },
              stats: { sanity: -5 },
              log: '你把所有电器都断了，在黑暗里坐了四十分钟。上面的人走了。',
              tone: 'neutral',
            },
          },
          {
            id: 'noise',
            label: '故意制造塌方的动静，让他们以为这里危险',
            check: {
              skill: 'stealth',
              dc: 11,
              ok: {
                world: { exposure: -14 },
                log: '你在远处的通道推倒了一堆水泥板。上面的人骂了一句，再没回来过。',
                tone: 'good',
              },
              bad: {
                world: { exposure: 12 },
                log: '声音太真了，反而证明了下面有人。他们在井口待了很久。',
                tone: 'bad',
              },
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'pressure_scout',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：措辞不绑定任何站点类型
        id: 'window_watcher',
        title: '有人在盯着这里',
        body: '你是在倒水的时候看见的。不远处站着一个人，不是路过——他已经在那里站了至少二十分钟，一直朝这个方向看。\n你昨晚开了一整夜发电机。',
        choices: [
          {
            id: 'blackout',
            label: '今晚全黑，一点声音都不出',
            effect: {
              world: { exposure: -18 },
              stats: { sanity: -6 },
              survivor: { morale: -8 },
              clearFlags: ['flag:gunshotRecent'],
              log: '你切断了所有电源。一整晚，一家人在黑暗里坐着，谁也没说话。',
              tone: 'neutral',
            },
          },
          {
            id: 'show_force',
            label: '让他看见你有枪',
            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              world: { exposure: 8 },
              stats: { humanity: -2 },
              faction: { looter: -4 },
              log: '你把猎枪举到他能看见的地方。他退了两步，转身走了。他会告诉别人这里有枪——这有两种后果。',
              tone: 'neutral',
            },
          },
          {
            id: 'confront',
            label: '直接出去问他要干什么',
            check: {
              skill: 'negotiation',
              dc: 12,
              ok: {
                world: { exposure: -6 },
                stats: { reputation: 3 },
                log: '他说他在找妹妹，从周三就开始找了。你给了他一点水。他记住了你的门牌号，但这次是好的那种记住。',
                tone: 'good',
              },
              bad: {
                world: { exposure: 14 },
                stats: { hp: -6, sanity: -6 },
                schedule: [{ familyId: 'raid_attempt', inDays: 2, tags: ['flag:markedByScout'] }],
                log: '他什么也没说，只是看着你，然后慢慢走了。两天后你会知道他去找了谁。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',
            label: '装作没看见',
            effect: {
              world: { exposure: 6 },
              schedule: [{ familyId: 'raid_attempt', inDays: 2, tags: ['flag:markedByScout'], unless: { all: ['exposure:calm'] } }],
              log: '你放下了窗帘。他还在那儿。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'ramp_mark',
        title: '坡道口的墙上多了一个记号',
        body: '一个用粉笔画的三角形，边长大概二十厘米，画在闸门左侧的柱子上。\n你昨天下班回来时它还不在。这个符号你在别的地方见过——上一次是在一栋后来被搬空的楼门口。',
        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'erase',
            label: '擦掉它，再画一个别的',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -13 },
              stats: { stamina: -8 },
              log: '你擦掉了三角形，在旁边画了一个圆圈和一道斜线——你不知道那代表什么，但看起来像是"已清"。',
              tone: 'good',
            },
          },
          {
            id: 'watch_ramp',
            label: '在坡道上布置警报（3 零件）',
            requires: { res: { parts: 3 } },
            effect: {
              res: { parts: -3 },
              setFlags: ['flag:alarmRig'],
              log: '你在坡道拐弯处拉了一条细铁丝，另一端连着一串罐头盒。',
              tone: 'good',
            },
          },
          {
            id: 'ignore',
            label: '一个粉笔记号而已',
            effect: {
              world: { exposure: 6 },
              schedule: [{ familyId: 'raid_attempt', inDays: 3, unless: { all: ['exposure:calm'] } }],
              log: '你没管它。三天后你会知道那个三角形是什么意思。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'tire_tracks',
        title: '雪地上多了一组脚印',
        body: '早上出门倒灰的时候你看见的。脚印从院墙外一直走到窗下，在那里站了一会儿，然后原路回去了。\n鞋码不小。而且他知道该往哪个窗户看。',
        require: { any: ['weather:snow', 'weather:blizzard'] },
        choices: [
          {
            id: 'cover',
            label: '把所有痕迹扫掉，加强伪装',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -14 },
              stats: { stamina: -10 },
              log: '你花了一上午把院子里所有的痕迹清掉，又在门口堆了些看起来很久没人动过的杂物。',
              tone: 'good',
            },
          },
          {
            id: 'trap',
            label: '在窗下布置警报（消耗零件）',
            requires: { res: { parts: 3 } },
            effect: {
              res: { parts: -3 },
              setFlags: ['flag:alarmRig'],
              log: '你用铁丝、罐头盒和几个螺母做了一套土警报。它不能挡人，但能让你提前三十秒知道。',
              tone: 'good',
            },
          },
          {
            id: 'wait',
            label: '什么也不做，等着看',
            effect: {
              world: { exposure: 5 },
              schedule: [{ familyId: 'raid_attempt', inDays: 3, unless: { all: ['exposure:calm'] } }],
              log: '你决定等。第二天脚印又多了一组。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'pressure_tribute',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：不带任何 require，保证任何灾难下这一档压力都不会静默消失
        id: 'street_toll',
        title: '街口新立了一道杆',
        body: '两个油桶架着一根钢管，旁边生着火。四五个人轮流守在那儿，谁都不穿制服。\n他们没来敲你的门，只是让你知道：从今天起，这条街进出要"打招呼"。\n傍晚有人来传话，说明天开始每户要交东西，不多，"够我们守夜就行"。',
        require: URBAN,
        forbid: { any: ['site:isolated', 'site:elevated'] },
        choices: [
          {
            id: 'pay',
            label: '交（1 份口粮 + 4 L 水）',
            requires: { res: { foodStaple: 1, water: 4 } },
            effect: {
              res: { foodStaple: -1, water: -4 },
              world: { exposure: -6 },
              setFlags: ['flag:paysTribute'],
              schedule: [{ familyId: 'pressure_tribute', inDays: 7 }],
              log: '你交了东西。守杆的人给了你一个用马克笔画的记号，让你贴在门上。',
              tone: 'neutral',
            },
          },
          {
            id: 'join',
            label: '不交钱，去轮守夜',
            requires: { stats: { stamina: 30 } },
            effect: {
              stats: { stamina: -22, reputation: 5, humanity: 2 },
              world: { neighborhood: 12, exposure: -4 },
              setFlags: ['flag:joinedWatch'],
              log: '你去守了半夜。冷得要命，但你认识了这条街上还活着的每一个人。',
              tone: 'good',
            },
          },
          {
            id: 'refuse',
            label: '不理这套',
            effect: {
              stats: { humanity: 2 },
              world: { exposure: 10, neighborhood: -8 },
              schedule: [{ familyId: 'raid_attempt', inDays: 4, unless: { all: ['exposure:calm'] } }],
              log: '你没交，也没去。第二天你的门上被人用马克笔画了一个不一样的记号。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'militia_tax',
        title: '有人来"登记"了',
        body: '四个人，两个带着猎枪，袖子上缠着一圈红布。领头的很客气，甚至没有敲门，只是在门外说话。\n"我们是北巷自治队。这条街现在由我们维持秩序。每周两份口粮、五升水，我们保证没人来动你。"\n"你可以不交。但那样我们就不知道谁会来。"',
        require: { any: ['faction:militia:active', 'faction:gang:active'] },
        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'pay',
            label: '交（2 份口粮 + 5 L 水）',
            requires: { res: { foodStaple: 2, water: 5 } },
            effect: {
              res: { foodStaple: -2, water: -5 },
              stance: { militia: 25, gov: -10 },
              setFlags: ['flag:paysTribute'],
              schedule: [{ familyId: 'pressure_tribute', inDays: 7 }],
              log: '你交了保护费。领头的在一个小本子上记了你的门牌号，说下周同一时间。',
              tone: 'neutral',
            },
          },
          {
            id: 'negotiate',
            label: '谈条件：用手艺抵',
            check: {
              skill: 'negotiation',
              dc: 13,
              ok: {
                stance: { militia: 18 },
                setFlags: ['flag:militiaFavor'],
                log: '你说你会修发电机。领头的想了想，说那你每周来修两台，粮就免了。',
                tone: 'good',
              },
              bad: {
                res: { foodStaple: -3, water: -6 },
                stats: { hp: -5 },
                stance: { militia: 5 },
                log: '他听完笑了，然后拿走了比原来更多的东西。"下次别废话。"',
                tone: 'bad',
              },
            },
          },
          {
            id: 'refuse',
            label: '拒绝',
            effect: {
              stats: { humanity: 3 },
              stance: { militia: -35 },
              world: { exposure: 12 },
              setFlags: ['flag:refusedTribute'],
              schedule: [{ familyId: 'raid_attempt', inDays: 3, tags: ['flag:militiaPunish'] }],
              log: '你说不交。领头的点点头，说理解，然后在本子上画了个别的记号。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'gov_requisition',
        title: '巡逻队要"清点"你的物资',
        body: '两辆车，六个人，制服是真的，臂章也是真的。他们带着表格。\n"战时物资统一调配。我们清点，登记，开条。等秩序恢复后凭条领回补偿。"\n领头的军官很年轻，看起来自己也不太相信那张条子。他身后的人已经开始往屋里走。',
        require: { all: ['disaster:nuclear'], any: ['faction:gov:active'] },
        choices: [
          {
            id: 'comply',
            label: '配合，让他们登记',
            effect: {
              res: { foodStaple: -6, water: -14, fuel: -6 },
              stance: { gov: 22 },
              setFlags: ['flag:govRegistered'],
              schedule: [{ familyId: 'story_gov_ration', inDays: 5 }],
              log: '他们拿走了六份口粮、十四升水和六升油，留给你一张盖了红章的白条。你把它压在了台历下面。',
              tone: 'neutral',
            },
          },
          {
            id: 'hide',
            label: '提前藏起大半，只交出一部分',
            check: {
              skill: 'stealth',
              dc: 12,
              ok: {
                res: { foodStaple: -2, water: -4 },
                stance: { gov: 12 },
                log: '你把主要的存货移到了通风管道后面。他们清点了摆在外面的那些，签字走了。',
                tone: 'good',
              },
              bad: {
                res: { foodStaple: -9, water: -20, meds: -3 },
                stats: { hp: -8 },
                stance: { gov: -30 },
                setFlags: ['flag:govHostile'],
                log: '那个年轻军官盯着地板上被拖过的痕迹看了三秒，然后指了指管道。他们把藏的全拿走了，还有你的药。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'militia_card',
            label: '说这条街由自治队管着',
            requires: { tags: { all: ['flag:paysTribute'] }, reason: '需要已在向自治队交保护费' },
            effect: {
              stance: { gov: -25, militia: 10 },
              setFlags: ['flag:markedCollaborator'],
              log: '你说出了自治队的名字。军官记下来了。你保住了物资，但从今天起你在他们的名单上换了一栏。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'boat_toll',
        title: '划艇的人在窗外收"过路费"',
        body: '水已经到了一楼窗台以上。三个人一条充气艇，绕着这片楼慢慢划。\n他们不上来，只是在下面喊："想出去就说话，一趟两份罐头。不出去也行，我们每天都来。"\n他们知道你在。他们知道所有人都在。',
        require: { any: ['weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'pay',
            label: '花 2 份罐头换一趟出行',
            requires: { res: { foodStaple: 2 } },
            effect: {
              res: { foodStaple: -2 },
              setFlags: ['flag:boatAccess'],
              log: '你付了两份罐头。他们说明天上午会来接你，去哪都行，只要不太远。',
              tone: 'neutral',
            },
          },
          {
            id: 'refuse',
            label: '不理，你能等水退',
            effect: {
              world: { exposure: 8 },
              log: '你没搭话。艇又绕了两圈才走。领头的那个抬头看了很久你所在的那扇窗。',
              tone: 'neutral',
            },
          },
          {
            id: 'radio',
            label: '用无线电联系救援队，绕过他们',
            requires: { modules: { radio: 1 }, reason: '需要 1 级无线电' },
            effect: {
              faction: { rescue: 12 },
              stance: { rescue: 18 },
              setFlags: ['flag:rescueContact'],
              log: '你在 121.5 上呼了三十分钟，终于有人应答。他们记下了你的坐标和人数。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'raid_attempt',
    kind: 'threat',
    intensity: 5,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：只要不是地下、不是被水围住，就是最朴素的那种破门
        id: 'crowbar',
        title: '有人在踹门',
        body: '不是敲，是踹。三个人，其中一个手里有撬棍，另外两个在替他挡着楼道口。\n他们不说话，也不喊话。这说明他们做过很多次了。\n门框在响。',
        forbid: { any: ['site:underground', 'weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'barricade',
            label: '用一切能搬的东西堵住门',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -18 },
              setFlags: ['flag:raidDefend'],
              log: '你把冰箱、书架、装满水的桶全推到了门后。',
              tone: 'neutral',
            },
          },
          {
            id: 'shoot',
            label: '朝门外开一枪',
            requires: { res: { ammo: 2 }, reason: '需要 2 发弹药' },
            effect: {
              res: { ammo: -2 },
              stats: { humanity: -6, sanity: -8 },
              world: { exposure: 14 },
              setFlags: ['flag:gunshotRecent', 'flag:firedWarning'],
              log: '你朝门板上方开了一枪。楼道里瞬间安静，然后是很快的脚步声。枪声会传得很远。',
              tone: 'neutral',
            },
          },
          {
            id: 'talk',
            label: '隔着门跟他们谈',
            check: {
              skill: 'negotiation',
              dc: 15,
              ok: {
                res: { foodStaple: -3 },
                stats: { humanity: 2 },
                log: '你从门缝递出三份罐头，说楼上还有两户空房可以撬。他们收了，走了。',
                tone: 'neutral',
              },
              bad: {
                stats: { sanity: -6 },
                setFlags: ['flag:raidDefend'],
                log: '门外那个人只回了一句："开门。"然后继续踹。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'hide',
            label: '带上能拿的躲进里屋',
            effect: {
              setFlags: ['flag:raidHide'],
              stats: { sanity: -10, humanity: -2 },
              log: '你抓了药和一半的罐头躲进卫生间，反锁，坐在地上。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'requisition_raid',
        title: '这次他们没带表格',
        body: '还是那身制服，但少了两个人，也没有车。臂章还在，但已经缝得歪了。\n"最后一次登记。"领头的说。他的枪不再背在肩上。\n没有本子，没有白条。今天这帮人已经不像上次来登记的政府军。',
        require: { all: ['disaster:nuclear'], any: ['faction:gov:active'] },
        choices: [
          {
            id: 'give_all',
            label: '全给他们，保命',
            effect: {
              res: { foodStaple: -8, water: -18, meds: -4, fuel: -8 },
              stats: { sanity: -10 },
              stance: { gov: 10 },
              log: '你什么都给了。领头的临走时说了句"对不住"，声音很低。',
              tone: 'grim',
            },
          },
          {
            id: 'fight',
            label: '抵抗',
            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              setFlags: ['flag:raidDefend', 'flag:foughtSoldiers'],
              stats: { humanity: -4 },
              log: '你决定不给。门后站了大约三十秒，然后脚步声走远了。',
              tone: 'bad',
            },
          },
          {
            id: 'appeal',
            label: '喊出那个年轻军官的名字',
            requires: { tags: { all: ['flag:govRegistered'] }, reason: '需要之前配合过登记' },
            check: {
              skill: 'negotiation',
              dc: 11,
              ok: {
                res: { foodStaple: -3, water: -6 },
                stance: { gov: 20 },
                setFlags: ['flag:officerFavor'],
                log: '你叫了他的姓。他愣了一下，只让人拿走了一小部分，还留下两盒压缩饼干。',
                tone: 'good',
              },
              bad: {
                res: { foodStaple: -8, water: -16, meds: -3 },
                log: '他没回头。拿走的东西一点没少。你不确定还是不是上次那个人。',
                tone: 'bad',
              },
            },
          },
        ],
      },
      {
        id: 'boat_raid',
        title: '有人在撬你二楼的窗户',
        body: '水面离窗台只有半米。一条橡皮艇拴在防盗网上，两个人踩在艇沿，正用一根撬棍撬窗框。\n他们湿透了，看起来已经这么干了好几家。\n你脚下的一楼全是水。你无处可退，他们也无路可撤。',
        require: { any: ['weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'push_boat',
            label: '推开他们的艇',
            check: {
              skill: 'fitness',
              dc: 12,
              ok: {
                stats: { stamina: -14 },
                world: { exposure: 4 },
                log: '你抓住撬棍猛地一带，艇失了平衡。他们没落水，但骂着划开了。',
                tone: 'good',
              },
              bad: {
                stats: { hp: -14, stamina: -18 },
                addCond: ['woundInfection'],
                setFlags: ['flag:raidDefend'],
                log: '你抓住了撬棍，然后被它砸中了小臂。窗户开了一半。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'trade',
            label: '主动给一点，换他们走',
            requires: { res: { foodStaple: 2 } },
            effect: {
              res: { foodStaple: -2, water: -4 },
              log: '你从窗缝塞出两份罐头和几瓶水。他们接了，解开绳子划走了。撬棍留在了窗台上。',
              tone: 'neutral',
            },
          },
          {
            id: 'defend',
            label: '守住窗户',
            effect: {
              setFlags: ['flag:raidDefend'],
              log: '你把桌子横着顶在窗框上，用身体压着。',
              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'vent_gasoline',
        title: '通风井上方有人在喊话',
        body: '声音顺着管道下来，带着回声，所以听起来像是从四面八方来的。\n"我们知道下面有人。我们能听见机器的声音。"\n停了几秒。\n"开门，还是我们往里面倒汽油。你自己选。"\n你抬头看那个格栅。它离地四米。',
        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'seal_vent',
            label: '立刻封住通风井（消耗建材）',
            requires: { res: { materials: 5 } },
            effect: {
              res: { materials: -5 },
              stats: { stamina: -12 },
              addCond: ['coPoisoning'],
              log: '你用木板和湿布把井口从下面堵死了。汽油没进来，但接下来的六小时你们几乎无法呼吸。',
              tone: 'neutral',
            },
          },
          {
            id: 'open',
            label: '开门，把东西给他们',
            effect: {
              res: { foodStaple: -7, water: -12, meds: -3 },
              stats: { sanity: -12, humanity: -2 },
              world: { exposure: 10 },
              log: '你打开了闸门。他们进来了，拿了很多。走的时候有人拍了拍你的肩膀。',
              tone: 'grim',
            },
          },
          {
            id: 'bluff',
            label: '喊回去：这下面是消防水泵房，有人值守',
            check: {
              skill: 'negotiation',
              dc: 14,
              ok: {
                world: { exposure: -10 },
                log: '你用最平静的声音报出了一串编号和一个不存在的值班表。上面沉默了很久，然后走了。',
                tone: 'good',
              },
              bad: {
                setFlags: ['flag:raidDefend'],
                world: { exposure: 8 },
                log: '上面那个人笑了。"水泵房没有柴油机的声音。"然后你听见了塑料桶的响声。',
                tone: 'bad',
              },
            },
          },
        ],
      },
      {
        id: 'frozen_crowd',
        title: '门口有一群冻僵的人',
        body: '七八个，也许更多。他们没有撬棍，也没有喊话，只是挤在门廊下背着风。\n最外面那个已经不动了。有个女人抱着一个用棉被裹起来的东西，看不出是不是活的。\n他们是来躲冷的。你屋里有暖气，他们没打算走。',
        require: { any: ['weather:blizzard', 'temp:freezing', 'temp:extreme'] },
        choices: [
          {
            id: 'let_in',
            label: '开门，让他们进来取暖',
            effect: {
              res: { fuel: -8, water: -10, foodStaple: -5 },
              stats: { humanity: 14, sanity: 6 },
              world: { exposure: 18, neighborhood: 20 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:openedDoorInBlizzard'],
              log: '你开了门。屋里挤了十几个人，一整晚都有人在哭。第二天早上走的时候，有一个留下了。',
              tone: 'good',
            },
          },
          {
            id: 'let_child',
            label: '只让那个抱孩子的女人进来',
            effect: {
              res: { fuel: -3, water: -4, foodStaple: -2 },
              stats: { humanity: 6, sanity: -6 },
              world: { exposure: 8 },
              log: '你只开了一条缝，把她拉了进来，然后立刻关上。门外的人没有骂你，这更难受。',
              tone: 'neutral',
            },
          },
          {
            id: 'closed',
            label: '不开门',
            effect: {
              stats: { humanity: -12, sanity: -14 },
              world: { neighborhood: -10 },
              setFlags: ['flag:closedDoorInBlizzard'],
              schedule: [{ familyId: 'story_frozen_morning', inDays: 1 }],
              log: '你没开门。你在里面听着，一直到没有声音了。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_ash_roof',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { all: ['weather:ashfall'] },
    variants: [
      {
        id: 'roof_load',
        title: '屋顶的积灰已经压出了裂缝',
        body: '火山灰比雪重得多——湿了之后更重。你听见天花板在某个位置发出了一声很轻的"咔"。\n如果不清，它会塌。如果清，你要在外面待两个小时，吸进去很多东西。',
        forbid: { all: ['site:underground'] },
        choices: [
          {
            id: 'clear',
            label: '上去清灰',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -20, hp: -4 },
              world: { exposure: 3 },
              log: '你在屋顶铲了两个小时。口罩很快就糊住了，你只能用围巾。',
              tone: 'neutral',
            },
          },
          {
            id: 'clear_masked',
            label: '戴好防护再上去',
            requires: { res: { meds: 1 }, tags: { all: ['mod:airFilter>=1'] }, reason: '需要 1 级空气过滤提供的防护装备' },
            effect: {
              res: { meds: -1 },
              stats: { stamina: -18 },
              log: '你戴上正压面罩上了屋顶。灰还是灰，但至少没进肺里。',
              tone: 'good',
            },
          },
          {
            id: 'ignore',
            label: '不管，赌它撑得住',
            effect: {
              shelter: { insulate: -1, fortify: -1 },
              stats: { hp: -8, sanity: -8 },
              log: '凌晨三点，厨房那一片天花板塌了。灰和水泥块埋了半个灶台。',
              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_flood_rise',
    kind: 'weather',
    intensity: 4,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { any: ['weather:flooding', 'water:flooded'] },
    variants: [
      {
        id: 'underground_flooding',
        title: '水从坡道流进来了',
        body: '你先听见的是声音，那种持续的、很宽的哗哗声。然后是气味。\n负一层已经满了。水正沿着车道往下淌，现在在你的脚踝，五分钟前它在门槛外面。\n这里是负二层。没有更低的地方了，但也没有向上的路。',
        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'evacuate',
            label: '立刻放弃这里，能搬多少搬多少',
            effect: {
              res: { water: -20, foodStaple: -8, materials: -10, parts: -6 },
              stats: { stamina: -26, sanity: -14 },
              shelter: { fortify: -2, insulate: -2, conceal: -1 },
              setFlags: ['flag:abandonedShelter'],
              log: '你在水到腰之前搬了三趟。剩下的都留在了下面。你花了三十天建的东西，在四十分钟里没了。',
              tone: 'bad',
            },
          },
          {
            id: 'dam',
            label: '在坡道上筑挡水墙（消耗大量建材）',
            requires: { res: { materials: 14 } },
            check: {
              skill: 'mechanics',
              dc: 13,
              ok: {
                res: { materials: -14 },
                stats: { stamina: -24 },
                setFlags: ['flag:floodWall'],
                log: '你用沙袋、木板和一整桶水泥封住了坡道。水停在了外面，只渗进来一点。',
                tone: 'good',
              },
              bad: {
                res: { materials: -14, water: -10, foodStaple: -4 },
                stats: { stamina: -28, hp: -10 },
                addCond: ['hypothermia'],
                log: '墙没扛住。半夜水推倒了它，你在齐胸深的冷水里抢出了几箱东西。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'pump',
            label: '用水泵往外抽（需要发电）',
            requires: { modules: { power: 1 }, res: { parts: 4 }, reason: '需要发电与 4 零件' },
            effect: {
              res: { parts: -4, fuel: -5 },
              stats: { stamina: -12 },
              setFlags: ['flag:sumpPump'],
              log: '你接了一台潜水泵，往坡道外抽。它的声音很大，一整夜都在响。水位停住了。',
              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'water_contaminated',
        title: '储水里有味道',
        body: '你打开水桶的时候闻到了。不是很明显，一点点土腥，混着别的东西。\n洪水已经把这个城市的下水道和化粪池全部搅在了一起。而你的储水桶昨天开过盖。',
        forbid: { all: ['site:elevated'] },
        choices: [
          {
            id: 'boil',
            label: '全部烧开（费燃料）',
            requires: { res: { fuel: 4 } },
            effect: {
              res: { fuel: -4 },
              stats: { stamina: -8 },
              log: '你把所有水分批烧开。烧开能杀死细菌，但杀不死化学物质。你只能希望是前者。',
              tone: 'neutral',
            },
          },
          {
            id: 'filter',
            label: '过一遍净水系统',
            requires: { modules: { filter: 1 }, reason: '需要 1 级净水' },
            effect: {
              stats: { sanity: 3 },
              log: '你把水全部倒回原水桶，让净水器重新跑了一遍。这就是你当初装它的理由。',
              tone: 'good',
            },
          },
          {
            id: 'drink',
            label: '就这么喝，你没有别的水',
            effect: {
              addCond: ['dysentery'],
              stats: { sanity: -5 },
              log: '你喝了。第二天早上你就知道自己错了。',
              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_cold_snap',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['temp:freezing', 'temp:extreme', 'weather:blizzard'] },
    variants: [
      {
        id: 'pipes',
        title: '水管冻了',
        body: '早上拧开龙头，什么也没有。管道从墙里发出一声闷响。\n如果它已经裂了，那么解冻的时候你会失去墙里的一切。而现在你唯一能确定的是：今天不会有自来水了。',
        forbid: { all: ['grid:on'] },
        choices: [
          {
            id: 'thaw',
            label: '用热水和布慢慢解冻',
            requires: { res: { fuel: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { fuel: -2 },
              stats: { stamina: -10 },
              log: '你花了一上午，一段一段地敷。管子活了，没裂。',
              tone: 'good',
            },
          },
          {
            id: 'torch',
            label: '直接用火烤快一点',
            check: {
              skill: 'mechanics',
              dc: 12,
              ok: {
                res: { fuel: -1 },
                log: '你控制着火焰，只烤接头。十分钟就通了。',
                tone: 'good',
              },
              bad: {
                res: { water: -12, materials: -3 },
                stats: { stamina: -14 },
                log: '接头爆了。墙里喷了两分钟，你的存水少了十二升，墙皮全湿了。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'wait',
            label: '不管它，反正也不指望自来水',
            effect: {
              log: '你把水管的事放下了。你早就在靠储水活着。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'med_neighbor_sick',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['contagion:high', 'contagion:low'] },
    forbid: { all: ['site:isolated'] },
    variants: [
      {
        id: 'fever_at_door',
        title: '门外的人在发烧',
        body: '是李姐。她站得离门有两米远，戴着口罩，声音是哑的。\n"孩子烧到四十度了。我知道我不该来。"她说，"你有药的话，放在楼梯口就行，我等你上去了再拿。"\n她说完就往后退了两步，退到猫眼看不见她的位置。',
        require: { none: ['neighbors:hostile'] },
        choices: [
          {
            id: 'give_meds',
            label: '把药放在楼梯口',
            requires: { res: { meds: 3 } },
            effect: {
              res: { meds: -3 },
              stats: { humanity: 8 },
              world: { neighborhood: 16, contagion: 1 },
              setFlags: ['flag:helpedSickNeighbor'],
              schedule: [{ familyId: 'story_neighbor_outcome', inDays: 4 }],
              log: '你把三组药放在了楼梯口，退回屋里。听见她上来，拿走，然后说了句谢谢。',
              tone: 'good',
            },
          },
          {
            id: 'go_treat',
            label: '亲自过去给孩子处置',
            requires: { skills: { medicine: 3 }, res: { meds: 2 }, reason: '需要医疗 3 级' },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 12, hp: -3 },
              world: { neighborhood: 25, contagion: 3 },
              setFlags: ['flag:treatedChild'],
              schedule: [{ familyId: 'story_neighbor_outcome', inDays: 3 }],
              log: '你去了。孩子的呼吸声不对，你处理了三个小时。回来之后你洗了很久的手。',
              tone: 'good',
            },
          },
          {
            id: 'refuse',
            label: '隔着门说没有',
            effect: {
              stats: { humanity: -9, sanity: -7 },
              world: { neighborhood: -18 },
              stance: { neighbors: -20 },
              setFlags: ['flag:refusedSickNeighbor'],
              log: '你说没有。她说好，谢谢，然后下楼了。你听着她的脚步声，一步一步。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'med_own_wound',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { any: ['cond:woundInfection', 'injured'] },
    variants: [
      {
        id: 'red_line',
        title: '那条红线又往上走了两厘米',
        body: '早上量的时候在手腕上方三指，现在快到肘窝了。\n伤口本身已经不疼了，这不是好消息。你知道再往上是什么。\n你手里有药，但不多。你也可以选择更狠的办法。',
        choices: [
          {
            id: 'meds',
            label: '按疗程用药',
            requires: { res: { meds: 4 } },
            effect: {
              res: { meds: -4 },
              removeCond: ['woundInfection'],
              stats: { hp: 6 },
              log: '你按剂量吃了整个疗程。第三天早上，那条线开始往回退。',
              tone: 'good',
            },
          },
          {
            id: 'debride',
            label: '自己清创',
            requires: { modules: { medbay: 1 }, reason: '需要 1 级医疗站' },
            check: {
              skill: 'medicine',
              dc: 12,
              ok: {
                res: { meds: -1 },
                removeCond: ['woundInfection'],
                stats: { hp: -6, sanity: -5 },
                log: '你把坏掉的部分刮掉了，用了半瓶碘伏和一条毛巾咬着。有效。',
                tone: 'good',
              },
              bad: {
                stats: { hp: -18, sanity: -12 },
                log: '你下手了，但没清干净，还弄破了别的地方。第二天你几乎起不来。',
                tone: 'bad',
              },
            },
          },
          {
            id: 'wait',
            label: '省药，扛过去',
            effect: {
              stats: { hp: -10, sanity: -6 },
              log: '你决定省着药。你告诉自己身体会赢。它可能会。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_trader',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { any: ['faction:trader:active', 'faction:trader:dormant'] },
    variants: [
      {
        id: 'cart_man',
        title: '有个推车的人在敲每一家的门',
        body: '一辆改装的手推车，上面用绑带固定着三个箱子。他很瘦，但眼睛很清醒。\n"不要钱，"他说，"钱现在是纸。我要药，要电池，要能修东西的零件。"\n他掀开一个箱子：里面是罐头、盐、火柴，和一小袋种子。',
        choices: [
          {
            id: 'trade_meds',
            label: '用 2 组药换食物和种子',
            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2, foodStaple: 7, materials: 1 },
              setFlags: ['flag:metTrader', 'flag:hasSeeds'],
              stance: { trader: 15 },
              log: '你用两组药换了七份罐头和一小袋菜种。他说下次还来。',
              tone: 'good',
            },
          },
          {
            id: 'trade_parts',
            label: '用 5 零件换燃料',
            requires: { res: { parts: 5 } },
            effect: {
              res: { parts: -5, fuel: 10 },
              setFlags: ['flag:metTrader' ],
              stance: { trader: 12 },
              log: '你用五个零件换了十升柴油。成交的时候他笑了，说你懂行。',
              tone: 'good',
            },
          },
          {
            id: 'buy_intel',
            label: '花 1 组药买情报',
            requires: { res: { meds: 1 } },
            effect: {
              res: { meds: -1 },
              setFlags: ['flag:traderIntel', 'flag:knowsNorthRoute'],
              stance: { trader: 8 },
              locations: [
                { id: 'warehouse', stock: 72 },
                { id: 'school', blocked: '路上有人设卡' },
              ],
              schedule: [{ familyId: 'opp_trader_warehouse', inDays: 1 }],
              log: '他压低声音说了三个地方：哪个仓库还没被清、哪条路上有人设卡、以及北边确实在收人。你把坐标写进日记。',
              tone: 'good',
            },
          },
          {
            id: 'pass',
            label: '你现在没有他要的东西',
            effect: {
              res: { water: 2 },
              stance: { trader: 3 },
              setFlags: ['flag:metTrader'],
              log: '你摇了摇头。他说没关系，问你需不需要水——他给了你两瓶，说下次记得就行。',
              tone: 'neutral',
            },
          },
          {
            id: 'rob',
            label: '他一个人，车上有你要的东西',
            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              res: { foodStaple: 9, meds: 3, fuel: 6, ammo: -1 },
              stats: { humanity: -22, sanity: -16, reputation: -14 },
              faction: { trader: -20 },
              stance: { trader: -60 },
              world: { exposure: 12 },
              setFlags: ['flag:robbedTrader', 'flag:gunshotRecent'],
              log: '你抢了他。他没有反抗，只是一直看着你，直到你让他走。他没有走远——他会告诉所有人。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_trader_warehouse',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    once: true,
    variants: [
      {
        id: 'main',
        title: '商人说的那个仓，卷帘门还虚掩着',
        body: '你按日记上的坐标走到仓储中心外围。没有灯，但锁被撬过，又被人用铁丝随便绕上。\n设卡那条路你绕开了。北边的事还写在同一页。',
        choices: [
          {
            id: 'note',
            label: '确认还能进去，改天带包来',
            effect: {
              stats: { sanity: 3 },
              log: '你没有今晚就冲。门缝里有纸箱的味道。存量还在。',
              tone: 'good',
            },
          },
          {
            id: 'skip',
            label: '什么都不做',
            effect: { stats: { stamina: 4, sanity: -2 }, log: '你看了一眼就走。坐标还在日记里。', tone: 'neutral' },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_supply_drop',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    weight: 6,
    cooldown: 14,
    require: { any: ['faction:gov:active', 'faction:rescue:active'] },
    variants: [
      {
        id: 'ration_point',
        title: '广播里报了一个配给点的地址',
        body: '每天上午九点到十一点，凭身份证领取，每人限一份。地址在三公里外的体育馆。\n广播念了三遍，然后是国歌。\n三公里，来回两小时，而且那里会有很多人——这两件事都很重要。',
        choices: [
          {
            id: 'go',
            label: '去排队',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { foodStaple: 5, water: 8 },
              stats: { stamina: -20 },
              world: { contagion: 3, exposure: 4 },
              log: '你排了两个小时，领到一箱压缩食品和两桶水。队伍里有人在咳嗽。',
              tone: 'good',
            },
          },
          {
            id: 'go_with_crew',
            label: '带同伴一起去，能多领几份',
            requires: { tags: { any: ['crew:some', 'crew:full'] }, ap: 1, reason: '需要有同伴' },
            effect: {
              ap: -1,
              res: { foodStaple: 10, water: 16 },
              stats: { stamina: -24 },
              world: { contagion: 6, exposure: 7 },
              survivor: { morale: 6 },
              log: '你们一起去，领了几份回来。回来的路上有人跟了你们两个街口。',
              tone: 'good',
            },
          },
          {
            id: 'skip',
            label: '不去，人多的地方比饿更危险',
            effect: {
              stats: { sanity: -2 },
              log: '你没去。下午广播说配给点发生了拥挤事件，暂停发放。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_neighbor_outcome',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'child_lived',
        title: '楼梯口放了一个铁盒',
        body: '里面是一把钥匙、一张手绘的小区管道图，和一张纸条。\n"孩子好了。这是地下室水泵房的钥匙，那里有个没人知道的储水口。图我画得不好，但能找到。"\n下面还有一行："以后你敲门，我一定开。"',
        require: { any: ['flag:helpedSickNeighbor', 'flag:treatedChild'] },
        choices: [
          {
            id: 'take',
            label: '收下',
            effect: {
              res: { water: 20 },
              stats: { sanity: 10, humanity: 4 },
              world: { neighborhood: 10 },
              setFlags: ['flag:pumpRoomKey'],
              log: '你去了水泵房。那里有一个满的消防水箱，两百多升。这是你救那个孩子换来的。',
              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'child_died',
        title: '三楼没有声音了',
        body: '你昨天听见的哭声在半夜停了。今天早上门口放着一个塑料袋，里面是你给的那几板药，只用了两片。\n没有纸条。',
        require: { any: ['flag:refusedSickNeighbor'] },
        choices: [
          {
            id: 'accept',
            label: '把药收回来',
            effect: {
              res: { meds: 1 },
              stats: { sanity: -16, humanity: -4 },
              world: { neighborhood: -12 },
              log: '你把药收了回来。它们会救别人的命，这个想法没让你好受一点。',
              tone: 'grim',
            },
          },
          {
            id: 'leave',
            label: '不动它',
            effect: {
              stats: { sanity: -8, humanity: 3 },
              log: '你没去拿。那个袋子在门口放了三天，然后不见了。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_frozen_morning',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'morning_after',
        title: '早上门推不开',
        body: '有东西靠在外面。你用了很大力气才推开一条缝。\n他们大部分走了。剩下两个还在门廊里，姿势像是睡着了。棉被裹着的那个东西在其中一个的怀里。\n雪已经把他们盖了一层。',
        choices: [
          {
            id: 'bury',
            label: '把他们搬到楼后，做个标记',
            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -18, sanity: -10, humanity: 6 },
              world: { neighborhood: 6 },
              log: '你花了一上午。你不知道他们叫什么，就在墙上用炭写了"两个人，一个孩子"和日期。',
              tone: 'grim',
            },
          },
          {
            id: 'take',
            label: '他们身上有些东西还能用',
            effect: {
              res: { foodStaple: 2, materials: 3, meds: 1 },
              stats: { humanity: -16, sanity: -18 },
              setFlags: ['flag:tookFromDead'],
              log: '你从他们的背包里拿了些东西。你的手抖得很厉害，但你还是拿了。',
              tone: 'grim',
            },
          },
          {
            id: 'close',
            label: '关上门，从后窗走',
            effect: {
              stats: { sanity: -12 },
              log: '你把门重新关上，之后一个星期都走后窗。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_family_radio',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'county_broadcast',
        title: '无线电里念到了那个县城的名字',
        body: '一段民用频段的转播，信号很差。念的是安置点名单，一个县一个县地念。\n念到那个名字的时候，后面跟着的是一串数字：接收人数、失联人数。\n第二个数字比第一个大。',
        require: { any: ['flag:familyAway', 'flag:familyLied'], all: ['mod:radio>=1'] },
        choices: [
          {
            id: 'call',
            label: '试着呼叫那个频段，问名单',
            requires: { modules: { radio: 2 }, reason: '需要 2 级无线电才能发射' },
            check: {
              skill: 'mechanics',
              dc: 12,
              ok: {
                stats: { sanity: 14, humanity: 4 },
                setFlags: ['flag:familyFound'],
                log: '有人回了你。他翻了三遍名单，最后说了一个床位号。她在。她还在。',
                tone: 'good',
              },
              bad: {
                stats: { sanity: -12 },
                setFlags: ['flag:familyUnknown'],
                log: '没有人应答。你叫了两个小时，最后只剩下自己的回声。',
                tone: 'grim',
              },
            },
          },
          {
            id: 'listen',
            label: '只是听着，记下数字',
            effect: {
              stats: { sanity: -8 },
              setFlags: ['flag:familyUnknown'],
              log: '你把两个数字记在了本子上，然后关掉了收音机。',
              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'stair_rumor',
        title: '楼道里有人在传安置点的名单',
        body: '没有收音机也传到了六楼。纸是手抄的，县名写错了一个字，但你还是认出来了。\n后面跟着两个数字。第二个比第一个大。',
        require: { any: ['flag:familyAway', 'flag:familyLied'] },
        choices: [
          {
            id: 'ask',
            label: '追问抄纸的人',
            effect: {
              stats: { sanity: -6, stamina: -4 },
              setFlags: ['flag:familyUnknown'],
              log: '对方说名单是别人抄的。数字对不上号。你记下了那个错字。',
              tone: 'grim',
            },
          },
          {
            id: 'keep',
            label: '把纸带回家',
            effect: {
              stats: { sanity: -4 },
              setFlags: ['flag:familyUnknown'],
              log: '纸在桌上。两个数字你看了很多遍。',
              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_convoy_news',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'convoy_fate',
        title: '车队的消息传回来了',
        body: '是从旧货市场那边听来的，转了三四手。\n出城的国道在第二个收费站被堵了，十一辆车里有六辆调头，剩下五辆走了小路。\n之后的部分没人说得清。只有人提到，其中一辆车后来出现在了另一批人手里。',
        require: { any: ['flag:convoyKnown', 'flag:choseToStay'] },
        choices: [
          {
            id: 'reflect',
            label: '你留下了',
            effect: {
              stats: { sanity: 6 },
              setFlags: ['flag:convoyFailed'],
              log: '你想起自己交的那三千块，也想起自己没上那辆车。报名那十一户，你现在能报出名字的不到五个。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_gov_ration',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'the_receipt',
        title: '那张白条派上用场了',
        body: '一辆卡车停在街口，还是那身制服。这次是发东西，凭之前的登记条。\n队伍不长——大部分人当时把物资藏了起来，现在没有条。\n你把压在台历下的那张纸拿出来了。',
        require: { any: ['flag:govRegistered'] },
        choices: [
          {
            id: 'claim',
            label: '去领',
            effect: {
              res: { foodStaple: 8, water: 12, meds: 2 },
              stance: { gov: 10 },
              stats: { sanity: 6 },
              log: '他们按条子上的数量给了你，还多给了两组药。发药的人没看你，只低头对了条子上的号码。',
              tone: 'good',
            },
          },
          {
            id: 'share',
            label: '领了，分一部分给没有条的邻居',
            effect: {
              res: { foodStaple: 4, water: 6, meds: 1 },
              stats: { humanity: 10, reputation: 8 },
              world: { neighborhood: 20 },
              log: '你把一半分给了楼里没登记的几家。李姐说她记着。',
              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'dream_sequence',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { all: ['sanity:low'] },
    variants: [
      {
        id: 'supermarket_dream',
        title: '你又回到了那家超市',
        body: '灯全亮着，冷柜在响，货架是满的。播报里在念一个促销活动。\n你推着车走过二号通道，弯下腰拿最后一箱矿泉水。\n直起身的时候，收银台后面站着的是李姐。她在等你结账。她的口罩上有血。\n"你少拿了一样东西。"她说。',
        choices: [
          {
            id: 'wake',
            label: '醒来',
            effect: {
              stats: { sanity: -3, stamina: -6 },
              log: '你在凌晨四点醒了，一身汗。屋里很冷，很黑，很安静。',
              tone: 'grim',
            },
          },
          {
            id: 'ask',
            label: '问她少拿了什么',
            effect: {
              stats: { sanity: 5, humanity: 2 },
              log: '她没有回答，只是指了指你身后。你转过身，梦就结束了。但你醒来时觉得轻了一点。',
              tone: 'neutral',
            },
          },
        ],
      },
    ],
  })
];
