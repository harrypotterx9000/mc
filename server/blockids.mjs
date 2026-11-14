// The game's block ids, read from its generated data at startup. The server
// does not run the game, but it must not accept an id no client can render:
// those would create invalid blocks in every other client's world.
import fs from 'node:fs';
import path from 'node:path';

export function loadBlockIds(projectRoot, log) {
  const ids = new Set([0]); // air
  let complete = true;
  try {
    const t = fs.readFileSync(path.join(projectRoot, 'js', 'blockdata.js'), 'utf8');
    for (const m of t.matchAll(/"id"\s*:\s*(\d+)/g)) ids.add(Number(m[1]));
  } catch (e) {
    complete = false;
    if (log) log.warn('blockdata_read_failed', { error: e.message });
  }
  try {
    const t = fs.readFileSync(path.join(projectRoot, 'js', 'blocks.js'), 'utf8');
    for (const re of [/defBlock\(\s*(\d+)/g, /BLOCKS\[(\d+)\]/g]) {
      for (const m of t.matchAll(re)) ids.add(Number(m[1]));
    }
    // Several id ranges are built from a colour table, so their source only
    // contains the first numeric id (e.g. defBlock(128 + i) for 16 wools).
    // Expand every such table by its entry count.
    for (const m of t.matchAll(/const\s+\w+\s*=\s*\[([\s\S]*?)\];/g)) {
      const tail = t.slice(m.index + m[0].length, m.index + m[0].length + 600);
      const bm = /defBlock\(\s*(\d+)\s*\+\s*i\b/.exec(tail);
      if (!bm) continue;
      const count = (m[1].match(/\[['"]/g) || []).length;
      const base = Number(bm[1]);
      for (let i = 0; i < count; i++) ids.add(base + i);
    }
    // FLOWER_IDS is a plain numeric table used as defBlock(FLOWER_IDS[i]).
    const flowers = /const\s+FLOWER_IDS\s*=\s*\[([\s\S]*?)\];/.exec(t);
    if (flowers) for (const n of flowers[1].match(/\d+/g) || []) ids.add(Number(n));
  } catch (e) {
    complete = false;
    if (log) log.warn('blocks_read_failed', { error: e.message });
  }
  // redstone wire levels 1..15 are their own ids (blocks.js assigns 4081..4095
  // through a variable, so the scan above cannot see them)
  for (let p = 4081; p <= 4095; p++) ids.add(p);
  if (!complete || ids.size < 32) {
    if (log) log.warn('block_ids_unavailable', { count: ids.size, complete });
    return null;
  }
  if (log) log.info('block_ids_loaded', { count: ids.size });
  return ids;
}
