"""Recolor display products from cached quantitative grids, never source Photos."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
from osgeo import gdal
from PIL import Image

VERSION = "20261026-band-hues-shared-rgb-v1"
COLORS = {
    "blue": "#0858b0", "green": "#087b35", "red": "#c82333",
    "red-edge": "#bd008f", "nir": "#6f23a8",
}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def family(nm):
    nm = int(nm)
    if nm in (444, 475):
        return "blue"
    if nm in (531, 560):
        return "green"
    if nm in (650, 668):
        return "red"
    if nm in (705, 717, 740):
        return "red-edge"
    if nm == 842:
        return "nir"
    raise ValueError(f"Unconfirmed wavelength: {nm}")


def ramp(nm):
    high = COLORS[family(nm)]
    end = np.array([int(high[i:i+2], 16) for i in (1, 3, 5)])
    return np.rint(247 + np.linspace(0, 1, 256)[:, None] * (end - 247)).astype(np.uint8)


def normalize(values, lo, hi):
    assert np.isfinite([lo, hi]).all() and hi > lo
    return np.rint(np.clip((np.nan_to_num(values) - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)


def band_rgba(values, valid, lo, hi, nm):
    rgba = np.zeros((*valid.shape, 4), np.uint8)
    rgba[:, :, :3] = ramp(nm)[normalize(values, lo, hi)]
    rgba[:, :, 3] = valid.astype(np.uint8) * 255
    return rgba


def rgb_rgba(values, valid, ranges):
    rgba = np.zeros((*valid.shape, 4), np.uint8)
    for c, (lo, hi) in enumerate(ranges):
        rgba[:, :, c] = normalize(values[c], lo, hi)
    rgba[:, :, 3] = valid.astype(np.uint8) * 255
    return rgba


def save_image(path, rgba):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(path, lossless=True, method=4, exact=True)
    with Image.open(path) as image:
        assert np.array_equal(np.asarray(image), rgba), f"Display encoding differs: {path.name}"


def fingerprint(path):
    return [path.stat().st_size, path.stat().st_mtime_ns, hashlib.sha256(path.read_bytes()).hexdigest()]


def inputs(cache, observations):
    rows = []
    for o in observations:
        if o["kind"] not in ("RE", "RGB"):
            continue
        key = f"{o['date']}-R{o['round']}"
        folder = cache / "analysis_output/viewer_completion_20261025" / key
        if o["kind"] == "RE":
            path = folder / "representative.npz"
            units = "stored_uint16"
        else:
            path = folder / f"{key}-canonical-RGB-1m.tif"
            units = "stored_uint16"
            if not path.is_file():
                previous = cache / "analysis_output/multispectral_rgb_1m_20261022" / key / "result.json"
                path = Path(read(previous)["path"])
                units = "reflectance_ratio"
        if not path.is_file():
            raise FileNotFoundError(f"Quantitative cache missing for {o['id']}: {path}")
        rows.append(dict(observation=o, key=key, path=path, units=units))
    return rows


def read_rgb(row):
    ds = gdal.Open(str(row["path"]), gdal.GA_ReadOnly)
    assert ds.RasterCount == 4
    if row["units"] == "reflectance_ratio":
        assert ds.GetMetadataItem("PRODUCT") == "MULTISPECTRAL_RGB_SUBSTITUTE"
    else:
        assert ds.GetMetadataItem("PRODUCT") == "CANONICAL_MULTISPECTRAL_RGB_1M"
    data = ds.ReadAsArray()
    values = data[:3].astype(np.float64)
    if row["units"] == "stored_uint16":
        values /= 32768
    valid = data[3] > 0
    assert valid.any() and np.isfinite(values[:, valid]).all()
    return values, valid


def self_test():
    assert family(705) == "red-edge" and family(842) == "nir"
    for nm in (444, 475, 531, 560, 650, 668, 705, 717, 740, 842):
        lut = ramp(nm)
        assert (np.diff(lut.astype(int), axis=0) <= 0).all()
        assert "#" + "".join(f"{v:02x}" for v in lut[-1]) == COLORS[family(nm)]
    values = np.array([[0., .5, 1.]])
    before = values.copy()
    valid = np.array([[True, True, False]])
    rgba = band_rgba(values, valid, 0, 1, 717)
    assert np.array_equal(rgba[0, 0, :3], ramp(717)[0])
    assert np.array_equal(rgba[0, 1, :3], ramp(717)[128])
    assert rgba[0, 2, 3] == 0
    assert np.array_equal(values, before)
    rgb = np.repeat(values[None], 3, axis=0)
    assert np.array_equal(rgb_rgba(rgb, valid, [[0, 1]]*3), rgb_rgba(rgb.copy(), valid, [[0, 1]]*3))
    assert normalize(np.array([-1, 0, 1, 2]), 0, 1).tolist() == [0, 0, 255, 255]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--cache-root", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_test()
    if args.self_test:
        print("PASS: wavelength colors, monotonic ramps, clipping, alpha, input preservation")
        return
    if args.cache_root is None:
        parser.error("--cache-root is required; raw Photos are not inputs")
    repo, cache = args.repo.resolve(), args.cache_root.resolve()
    viewer = repo / "drone/viewer"
    catalog = read(viewer / "catalog.json")
    published = read(repo / "tools/mosaic/published_views.json")
    assert catalog["observations"] == published["observations"]
    rows = inputs(cache, catalog["observations"])
    count = {kind: sum(r["observation"]["kind"] == kind for r in rows) for kind in ("RE", "RGB")}
    assert count == {"RE": 14, "RGB": 19}, count
    assert shutil.disk_usage(repo).free > 512 * 1024**2
    print("PREFLIGHT", count, "free_GiB", round(shutil.disk_usage(repo).free / 2**30, 2),
          "display_output_estimate_MiB", 100, flush=True)
    if not args.apply:
        return
    output = (args.output or cache / "analysis_output/viewer_display_colors_20261026").resolve()
    output.mkdir(parents=True, exist_ok=True)
    write(output / "catalog_before.json", catalog)
    write(output / "published_before.json", published)
    ndvi_before = deepcopy([o for o in catalog["observations"] if o["kind"] == "NDVI"])
    spectra_before = deepcopy([o.get("spectrum") for o in catalog["observations"]])
    fingerprints = {r["path"]: fingerprint(r["path"]) for r in rows}
    # All RGB grids are 1m valid-area means: pool their valid ground cells, not byte thumbnails.
    channels = [[], [], []]
    for r in rows:
        if r["observation"]["kind"] == "RGB":
            values, valid = read_rgb(r)
            for c in range(3):
                channels[c].append(values[c, valid])
    ranges = [np.percentile(np.concatenate(c), [5, 95]).tolist() for c in channels]
    sample_count = sum(len(c) for c in channels[0])
    del channels
    rgb_policy = dict(version=VERSION, wavelengthsNm=[668, 560, 475], rangeScope="all-registered-RGB-rounds",
        rangeBasis="pooled-alpha-valid-1m-area-mean-pixels-P05-P95", rounds=count["RGB"],
        validSamples=sample_count, rangesReflectance=ranges, gamma=1, whiteBalance="fixed-global-channel-ranges",
        sourceValuesChanged=False)
    files = []
    for r in rows:
        o = r["observation"]
        o["displayVersion"] = VERSION
        if o["kind"] == "RE":
            cfg = o["spectral"]
            with np.load(r["path"]) as z:
                data = z["data"]
            assert data.dtype == np.uint16
            assert data.shape == (11, cfg["displayHeight"], cfg["displayWidth"])
            valid = data[10] > 0
            cfg["colorMap"] = "band-specific-single-hue"
            cfg["displayVersion"] = VERSION
            for b in cfg["bands"]:
                nm = b["wavelengthNm"]
                b["colorMap"], b["colorHigh"] = family(nm), COLORS[family(nm)]
                b["palette"] = ["#" + "".join(f"{v:02x}" for v in rgb) for rgb in ramp(nm)]
                values = data[b["band"]-1].astype(np.float64) * cfg["scale"]
                for mode, keys, stats in [("minmax", ("min", "max"), b["stats"]),
                                          ("p05p95", ("p05", "p95"), b.get("fieldStats", b["stats"]))]:
                    lo, hi = [stats[k] for k in keys]
                    name = b["images"][mode]
                    save_image(viewer / name, band_rgba(values, valid, lo, hi, nm))
                    files.append(name)
            rgba = rgb_rgba(data[[5, 3, 1]].astype(np.float64) / 32768, valid, ranges)
        else:
            values, valid = read_rgb(r)
            rgba = rgb_rgba(values, valid, ranges)
        name = o["staticImage"]["url"]
        save_image(viewer / name, rgba)
        files.append(name)
        o["rgbDisplay"] = deepcopy(rgb_policy)
        o["rgbDisplay"]["sourceGroup"] = r["key"]
        # The old per-image-stretched Drive COG is no longer a display source.
        o["thumbnail"] = name
        o["type"] = o["type"].replace("P05–P95 표시", "공통 P05–P95 표시")
        print("DISPLAY_READY", o["id"], flush=True)
    assert ndvi_before == [o for o in catalog["observations"] if o["kind"] == "NDVI"]
    assert spectra_before == [o.get("spectrum") for o in catalog["observations"]]
    assert all(fingerprints[p] == fingerprint(p) for p in fingerprints)
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for path, doc in [(viewer / "catalog.json", catalog), (repo / "tools/mosaic/published_views.json", published)]:
        doc["observations"] = catalog["observations"]
        doc["updated_at"] = stamp
        doc["displayPolicy"] = dict(version=VERSION, bandHighColors=COLORS, rgb=rgb_policy,
                                    quantitativeValuesChanged=False, ndviChanged=False)
        write(path, doc)
    report = dict(version=VERSION, updatedAt=stamp, rounds=count, files=files, rgb=rgb_policy,
        sourceCachesUnchanged=True, spectraMetadataUnchanged=True, ndviMetadataUnchanged=True,
        outputBytes=sum((viewer / f).stat().st_size for f in set(files)),
        legacyFilenamesRetained=True)
    write(output / "validation.json", report)
    print("PASS", len(files), "display images", round(report["outputBytes"] / 2**20, 2), "MiB", flush=True)


if __name__ == "__main__":
    gdal.UseExceptions()
    gdal.SetConfigOption("GDAL_PAM_ENABLED", "NO")
    main()
