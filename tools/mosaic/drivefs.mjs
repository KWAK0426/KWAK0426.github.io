// Google Drive 데스크톱 앱(G:\내 드라이브)의 내부 목록(metadata_sqlite_db) 복사본을 읽어
// 이미 올라간 파일의 Drive ID를 찾는다. Google Cloud 설정·로그인 없이 동작한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_NAMES = ['내 드라이브', 'My Drive'];

export function desktopDriveDir() {
  if (process.env.DRIVE_DESKTOP_DIR) return fs.existsSync(process.env.DRIVE_DESKTOP_DIR) ? process.env.DRIVE_DESKTOP_DIR : null;
  if (process.platform !== 'win32') return null;
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
    for (const name of ROOT_NAMES) {
      const p = `${letter}:\\${name}`;
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function metadataDbs() {
  const base = process.env.DRIVEFS_DIR || path.join(process.env.LOCALAPPDATA || '', 'Google', 'DriveFS');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .map((d) => path.join(base, d, 'metadata_sqlite_db'))
    .filter((f) => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function withMetadata(fn) {
  const dbs = metadataDbs();
  if (!dbs.length) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-drivefs-'));
  try {
    const copy = path.join(tmp, 'm.db');
    fs.copyFileSync(dbs[0], copy);
    if (fs.existsSync(dbs[0] + '-wal')) fs.copyFileSync(dbs[0] + '-wal', copy + '-wal');
    const db = new DatabaseSync(copy);
    try { return fn(db); } finally { db.close(); }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const isCloudId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{15,}$/.test(id) && !/^local/i.test(id);

// paths: [['김해논_드론', '2026-07-16', '260716_DEM.tif'], …] (내 드라이브 기준) → Drive ID 또는 null
export function lookupDriveIds(paths) {
  return withMetadata((db) => {
    const root = db.prepare(
      `SELECT stable_id FROM items WHERE is_folder = 1 AND trashed = 0 AND local_title IN (${ROOT_NAMES.map(() => '?').join(',')})
       AND id LIKE '0A%' LIMIT 1`
    ).get(...ROOT_NAMES);
    if (!root) return paths.map(() => null);
    const child = db.prepare(
      `SELECT i.stable_id, i.id FROM items i JOIN stable_parents p ON p.item_stable_id = i.stable_id
        WHERE p.parent_stable_id = ? AND i.local_title = ? AND i.trashed = 0 AND i.is_tombstone = 0
        ORDER BY i.modified_date DESC LIMIT 1`
    );
    const cache = new Map();
    const resolve = (segs) => {
      let parent = root.stable_id;
      let id = null;
      for (let i = 0; i < segs.length; i++) {
        const key = segs.slice(0, i + 1).join('/');
        let row = cache.get(key);
        if (row === undefined) { row = child.get(parent, segs[i]) ?? null; cache.set(key, row); }
        if (!row) return null;
        parent = row.stable_id;
        id = row.id;
      }
      return isCloudId(id) ? id : null;
    };
    return paths.map(resolve);
  }) ?? paths.map(() => null);
}
