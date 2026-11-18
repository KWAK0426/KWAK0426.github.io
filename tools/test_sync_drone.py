import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_drone', Path(__file__).with_name('sync_drone.py'))
sync_drone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_drone)


def summary():
    return {
        'format': 'gimhae-drone-summary-v1', 'published_at': '2026-11-18',
        'totals': {'rounds': 2, 'photos_total': 643},
        'rounds': [
            {'date': '2026-08-24', 'round': 1, 'photos': 0},
            {'date': '2026-08-24', 'round': 2, 'photos': 643, 'gps': True, 'dem': True},
        ],
    }


class SyncTests(unittest.TestCase):
    def test_guard(self):
        old = summary()
        self.assertEqual(sync_drone.regressions(old, copy.deepcopy(old)), [])
        bad = copy.deepcopy(old)
        bad['rounds'][1]['photos'] = 0
        self.assertTrue(sync_drone.regressions(old, bad))
        bad = copy.deepcopy(old)
        bad['rounds'][0]['photos'] = 643
        self.assertTrue(sync_drone.regressions(old, bad))
        bad = copy.deepcopy(old)
        bad['rounds'][1]['gps'] = False
        self.assertTrue(sync_drone.regressions(old, bad))
        rgb = copy.deepcopy(old)
        rgb['rounds'][1]['rgb_start_kst'] = '2026-08-24 11:00:00'
        rgb['rounds'][1]['rgb_end_kst'] = '2026-08-24 11:30:00'
        rgb['rounds'][1]['rgb_count'] = 400
        self.assertTrue(sync_drone.regressions(rgb, old))
        bad = copy.deepcopy(old)
        bad['rounds'].pop()
        self.assertTrue(sync_drone.regressions(old, bad))

    def test_block_before_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, target = root / 'source', root / 'drone'
            source.mkdir()
            target.mkdir()
            old = summary()
            (target / 'summary.json').write_text(json.dumps(old), encoding='utf-8')
            (target / 'index.html').write_text('existing', encoding='utf-8')
            old['rounds'][1]['photos'] = 0
            (source / 'summary.json').write_text(json.dumps(old), encoding='utf-8')
            (source / 'index.html').write_text('incoming', encoding='utf-8')
            with patch.object(sync_drone, 'HUB', root), patch.object(sys, 'argv', ['sync_drone', str(source)]):
                with self.assertRaises(SystemExit):
                    sync_drone.main()
            self.assertEqual((target / 'index.html').read_text(encoding='utf-8'), 'existing')
            self.assertEqual(json.loads((target / 'summary.json').read_text(encoding='utf-8'))['rounds'][1]['photos'], 643)


if __name__ == '__main__':
    unittest.main()

