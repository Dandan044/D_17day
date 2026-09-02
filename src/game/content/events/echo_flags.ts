import type { EventFamily, EventVariant } from '../../types';
import { skip } from './factory';

/** 旗标按主题分簇，避免上百条共用同一篇「洗手想起一件事」 */
const ECHO_CLUSTERS = {
  water: [
    'flag:gaveWaterOnce',
    'flag:liedNoWater',
    'flag:lentRope',
    'flag:bucketToilet',
    'flag:sealedToilet',
    'flag:caughtDrip',
    'flag:filterReplaced',
    'flag:isolatedWater',
    'flag:tankKey',
    'flag:tankAsked',
  ],
  door: [
    'flag:bracedDoor',
    'flag:elevatorWarned',
    'flag:stairLit',
    'flag:stairMarked',
    'flag:windowRetaped',
    'flag:curtainsDrawn',
    'flag:shoesOutside',
    'flag:mappedClicks',
    'flag:drilledOnce',
  ],
  radio: [
    'flag:metRadioNeighbor',
    'flag:radioClip',
    'flag:copiedCoords',
    'flag:radioReplied',
    'flag:ignoredCoords',
    'flag:twoNorthStories',
    'flag:scannedBands',
  ],
  neighbor: [
    'flag:refusedChild',
    'flag:helpedOpposite',
    'flag:oppositeLeaving',
    'flag:helpedSchoolKid',
    'flag:schoolRumor',
    'flag:kidMask',
    'flag:wavedAcross',
    'flag:knockedNext',
    'flag:waitedNext',
    'flag:fedStairKid',
    'flag:signaledKid',
    'flag:stoppedLooking',
    'flag:watchedKid',
    'flag:sawEmptyWindow',
    'flag:helpedShaft',
    'flag:buildingList',
    'flag:heardBuildingMeet',
  ],
  ration: [
    'flag:ateEnough',
    'flag:hidRation',
    'flag:tossedBulge',
    'flag:setSchedule',
    'flag:foundStash',
    'flag:stockList',
    'flag:touchedRation',
    'flag:acceptedRation',
    'flag:rehearsedEmpty',
    'flag:sealedFood',
    'flag:saltedRice',
    'flag:lastCleanShirt',
  ],
  build: [
    'flag:hasPlywood',
    'flag:chargedUp',
    'flag:sharedOutage',
    'flag:powerList',
    'flag:mustWork',
    'flag:packMarks',
    'flag:tradedPower',
    'flag:bracedBalcony',
    'flag:abandonedBalcony',
    'flag:ignoredBalcony',
  ],
  outing: [
    'flag:gotCashOut',
    'flag:bankRun',
    'flag:withdrewTwice',
    'flag:lastParcel',
    'flag:stoleParcel',
    'flag:rewroteList',
    'flag:listHole',
    'flag:plannedNight',
    'flag:nightCalled',
    'flag:tookStairFood',
    'flag:usedFireExit',
    'flag:stairNote',
    'flag:tiptoedStair',
    'flag:hasEvacMap',
  ],
  ash: [
    'flag:baggedAsh',
    'flag:leftAsh',
    'flag:talkedLevy',
    'flag:sawDrop',
    'flag:sawHallSource',
    'flag:lateIodine',
    'flag:watchedNeck',
    'flag:ignoredNeck',
  ],
  list: [
    'flag:rentPaid',
    'flag:rentDelayed',
    'flag:mutedChat',
    'flag:savedNotices',
    'flag:keptScar',
    'flag:changedThesis',
    'flag:fixedCalendar',
    'flag:coveredMirror',
    'flag:answeredSlot',
    'flag:askedSlotWater',
  ],
  sleep: [
    'flag:quietSlept',
    'flag:permitSleep',
    'flag:sleptBathroom',
    'flag:usedBirthdayCandle',
    'flag:listenedPipe',
    'flag:tappedPipe',
    'flag:admittedHurt',
    'flag:lightPack',
    'flag:seenFlinch',
    'flag:darkCandle',
  ],
} as const;

type EchoCluster = keyof typeof ECHO_CLUSTERS;

const FLAG_TO_CLUSTER = new Map<string, EchoCluster>();
for (const [cluster, flags] of Object.entries(ECHO_CLUSTERS) as Array<[EchoCluster, readonly string[]]>) {
  for (const f of flags) FLAG_TO_CLUSTER.set(f, cluster);
}

const ALL_ECHO_FLAGS = Object.values(ECHO_CLUSTERS).flat();

function echoVariant(flag: string): EventVariant {
  const cluster = FLAG_TO_CLUSTER.get(flag) ?? 'list';
  return {
    id: flag.replace(/^flag:/, ''),
    copyKey: cluster,
    require: { all: [flag] },
    choices: [
      {
        id: 'ack',
        effect: { stats: { sanity: 2 }, tone: 'good' },
      },
      skip(),
    ],
  };
}

export const ECHO_SLICE_EVENTS: EventFamily[] = [
  {
    id: 'hook_echo_sliceflags',
    kind: 'story',
    intensity: 1,
    phase: ['prep', 'survival'],
    baseWeight: 4,
    cooldown: 14,
    variants: ALL_ECHO_FLAGS.map(echoVariant),
  },
];
