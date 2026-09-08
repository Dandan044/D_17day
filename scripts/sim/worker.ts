/**
 * 分片工人：从 stdin 读 PlayJob[]，向 stdout 写 PlayResult。
 * 由 simulate.ts 用 child_process 拉起，避免 worker_threads + tsx 在 Windows 上踩坑。
 */

import { playJobs, type PlayJob } from './play';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}
const raw = Buffer.concat(chunks).toString('utf8').trim();
if (!raw) {
  process.stdout.write(JSON.stringify({ outcomes: [], errors: [] }));
  process.exit(0);
}
const jobs = JSON.parse(raw) as PlayJob[];
process.stdout.write(JSON.stringify(playJobs(jobs)));
