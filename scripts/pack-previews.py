"""Convertit les captures brutes (assets/preview/_raw) en WebP versionnes (assets/preview/<id>.webp).
Fixes : fonds (400x250, eclaircis s'ils sont tres sombres), jetons, morpion, echiquiers, skins.
Animes : serpents de curseur, skin arc-en-ciel, effets de clic, bannieres. Usage : python3 -I scripts/pack-previews.py"""
import glob, os, re
from PIL import Image, ImageEnhance, ImageStat
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'preview')
RAW = os.path.join(ROOT, '_raw')
def save_static(src, dst, size):
    im = Image.open(src).convert('RGB'); im.thumbnail(size, Image.LANCZOS); im.save(dst, 'WEBP', quality=82, method=6)
def save_anim(frames, dst, ms, crop=None, maxw=300):
    out = []
    for f in frames:
        im = Image.open(f).convert('RGB')
        if crop: im = im.crop(crop)
        if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        out.append(im)
    out[0].save(dst, 'WEBP', save_all=True, append_images=out[1:], duration=ms, loop=0, quality=76, method=6)
n = 0
for f in sorted(glob.glob(RAW + '/bg-*.png')):
    i = os.path.basename(f)[:-4]; im = Image.open(f).convert('RGB'); im = im.resize((400, 250), Image.LANCZOS)
    lum = ImageStat.Stat(im.convert('L')).mean[0]
    if lum < 60: im = ImageEnhance.Brightness(im).enhance(min(2.4, 60 / max(lum, 8)))   # fonds tres sombres : on voit enfin le motif
    im.save(f'{ROOT}/{i}.webp', 'WEBP', quality=82, method=6); n += 1
for pat in ('p4token-*', 'ttt-*', 'chess-*'):
    for f in sorted(glob.glob(f'{RAW}/{pat}.png')):
        save_static(f, f'{ROOT}/{os.path.basename(f)[:-4]}.webp', (260, 260)); n += 1
for f in sorted(glob.glob(RAW + '/snakeskin-*_00.png')):
    i = re.sub(r'_00\.png$', '', os.path.basename(f))
    fr = sorted(glob.glob(f'{RAW}/{i}_*.png'))
    if len(fr) > 1: save_anim(fr, f'{ROOT}/{i}.webp', 110, maxw=300)
    else: save_static(f, f'{ROOT}/{i}.webp', (300, 200))
    n += 1
groups = {}
for f in glob.glob(RAW + '/*_[0-9][0-9].png'):
    m = re.match(r'(.+)_(\d\d)\.png$', os.path.basename(f))
    if m and not m.group(1).startswith('snakeskin'): groups.setdefault(m.group(1), []).append(f)
for i, fr in sorted(groups.items()):
    fr.sort()
    if i.startswith('clickfx'): save_anim(fr[:11], f'{ROOT}/{i}.webp', 70, crop=(60, 40, 240, 200), maxw=240)
    elif i.startswith('cursorsnake'): save_anim(fr, f'{ROOT}/{i}.webp', 90, maxw=300)
    else: save_anim(fr, f'{ROOT}/{i}.webp', 90, maxw=320)
    n += 1
print(n, 'apercus ecrits,', round(sum(os.path.getsize(f) for f in glob.glob(ROOT + '/*.webp')) / 1024), 'ko')
