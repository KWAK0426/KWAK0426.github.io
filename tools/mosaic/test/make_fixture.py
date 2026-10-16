"""시험용 김해 논 자료 만들기: DEM(UTM 52N) · 광학(RGBA) · 다분광(5밴드 반사도) · GPS CSV
    python make_fixture.py <폴더>
"""
import csv
import os
import sys

import numpy as np
from osgeo import gdal, osr

gdal.UseExceptions()
root = sys.argv[1]
d = os.path.join(root, '2026-07-16')
os.makedirs(d, exist_ok=True)
srs = osr.SpatialReference()
srs.ImportFromEPSG(32652)
x0, y0 = 486000.0, 3896000.0  # 김해 부근 UTM 52N


def make(name, w, h, px, bands, dtype, fill):
    ds = gdal.GetDriverByName('GTiff').Create(os.path.join(d, name), w, h, bands, dtype, ['TILED=YES', 'COMPRESS=DEFLATE'])
    ds.SetGeoTransform([x0, px, 0, y0, 0, -px])
    ds.SetProjection(srs.ExportToWkt())
    fill(ds)
    ds.FlushCache()


yy, xx = np.mgrid[0:300, 0:300]


def dem(ds):
    b = ds.GetRasterBand(1)
    b.SetNoDataValue(-9999)
    a = (12.0 + 0.01 * xx).astype('float32')
    a[:5, :5] = -9999
    b.WriteArray(a)


def rgb(ds):
    for i in range(3):
        ds.GetRasterBand(i + 1).WriteArray(((xx * (i + 1)) % 256).astype('uint8').repeat(2, 0).repeat(2, 1))
    al = np.full((600, 600), 255, 'uint8')
    al[:50] = 0
    ds.GetRasterBand(4).SetColorInterpretation(gdal.GCI_AlphaBand)
    ds.GetRasterBand(4).WriteArray(al)


def re(ds):
    for i in range(5):
        a = (0.05 + 0.1 * i + 0.0005 * xx).astype('float32')
        a[:, :20] = -10000
        b = ds.GetRasterBand(i + 1)
        b.SetNoDataValue(-10000)
        b.WriteArray(a)
        b.SetDescription(['Blue', 'Green', 'Red', 'NIR', 'Red edge'][i])


make('260716_DEM.tif', 300, 300, 1.0, 1, gdal.GDT_Float32, dem)
make('260716_R1_RGB.tif', 600, 600, 0.5, 4, gdal.GDT_Byte, rgb)
make('260716_R1_RE.tif', 300, 300, 1.0, 5, gdal.GDT_Float32, re)

# GPS: 비행 중 점은 지면 위 80 m, 이륙 3점은 2 m
wgs = osr.SpatialReference()
wgs.ImportFromEPSG(4326)
wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
tr = osr.CoordinateTransformation(srs, wgs)
k = 0
with open(os.path.join(d, '260716_R1_GPS.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['Image', 'Latitude', 'Longitude', 'Altitude (m)', 'Relative Altitude'])
    for gx in range(20, 280, 26):
        for gy in range(20, 280, 22):
            lon, lat, _ = tr.TransformPoint(x0 + gx + 0.5, y0 - gy - 0.5)
            w.writerow([f'IMG_{k:04d}.tif', f'{lat:.9f}', f'{lon:.9f}', f'{12.0 + 0.01 * gx + 80:.3f}', '80'])
            k += 1
    for j in range(3):
        lon, lat, _ = tr.TransformPoint(x0 + 150.5, y0 - 150.5)
        w.writerow([f'TAKEOFF_{j}.tif', f'{lat:.9f}', f'{lon:.9f}', f'{12.0 + 1.5 + 2:.3f}', '2'])

# 이름 양식이 아닌 파일 · 날짜가 다른 파일
with open(os.path.join(d, 'memo.txt'), 'w') as f:
    f.write('x')
with open(os.path.join(d, '260717_R2_RGB.tif'), 'w') as f:
    f.write('x')
print('ok', k)
