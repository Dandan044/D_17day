/**
 * 文案目录入口：import 一次即注册全部中文表。
 * 内容 hydrate 与 UI/引擎 t() 都依赖这里先执行。
 */

import './names';
import './zh/disasters';
import './zh/endings';
import './zh/intel';
import './zh/world';
import './zh/ledger';
import './zh/ui';
import './zh/events/index';

export { t, tList, hasCopy, allCopy, pickCopy, flatten, register, registerTree } from './t';
export {
  RES_NAME,
  RES_UNIT,
  SKILL_NAME,
  STAT_NAME,
  WEATHER_NAME,
  WEATHER_DESC,
  THREAT_NAMES,
  THREAT_DESC,
  TIER_NAMES,
  TIER_DESC,
  MODULE_NAME,
  LOAD_NAME,
  SOURCE_NAME,
  FACTION_NAME,
  KIND_NAME,
  TREE_NAMES,
  BUILD_PATH_NAME,
  DIFFICULTY_NAME,
  HOOK_NAME,
  SITE_TAG_NAME,
} from './names';
export { hydrateFamily, hydrateFamilies, hydrateNamed } from './hydrate';
