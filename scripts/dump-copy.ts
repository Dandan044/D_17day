/**
 * 按 id 导出全部已注册中文，便于改稿与检重。
 * 用法：npm run dump-copy
 */

import '../src/game/copy';
import { allCopy } from '../src/game/copy/t';

for (const [k, v] of allCopy()) {
  console.log(`${k}\t${v.replace(/\r?\n/g, '\\n')}`);
}
