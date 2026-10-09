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
def bright(im):
    lum = ImageStat.Stat(im.convert('L')).mean[0]
    return ImageEnhance.Brightness(im).enhance(min(1.6, 50 / max(lum, 8))) if lum < 38 else im   # fonds tres sombres : on voit enfin le motif
for f in sorted(glob.glob(RAW + '/bg-*.png')):
    if re.search(r'_\d\d\.png$', f): continue
    i = os.path.basename(f)[:-4]
    fr = sorted(glob.glob(f'{RAW}/{i}_[0-9][0-9].png'))
    ims = [bright(Image.open(x).convert('RGB').resize((400, 250), Image.LANCZOS)) for x in (fr or [f])]
    # Anime seulement si les images different vraiment (ecart moyen de luminance entre 2 images).
    moves = False
    if len(ims) > 1:
        g = [im.convert('L').resize((80, 50)) for im in ims]
        moves = max(ImageStat.Stat(Image.blend(g[0], x, 1).convert('L')).mean[0] * 0 + sum(abs(a - b) for a, b in zip(g[0].getdata(), x.getdata())) / 4000 for x in g[1:]) > 0.2
    if moves:
        small = [im.resize((320, 200), Image.LANCZOS) for im in ims]
        small[0].save(f'{ROOT}/{i}.webp', 'WEBP', save_all=True, append_images=small[1:], duration=140, loop=0, quality=70, method=6)
        print('anime', i)
    else:
        ims[0].save(f'{ROOT}/{i}.webp', 'WEBP', quality=82, method=6)
    n += 1
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
    if m and not m.group(1).startswith(('snakeskin', 'bg-')): groups.setdefault(m.group(1), []).append(f)
for i, fr in sorted(groups.items()):
    fr.sort()
    if i.startswith('clickfx'): save_anim(fr, f'{ROOT}/{i}.webp', 70, crop=(40, 20, 260, 220), maxw=240)
    elif i.startswith('cursorsnake'): save_anim(fr, f'{ROOT}/{i}.webp', 90, maxw=300)
    else: save_anim(fr, f'{ROOT}/{i}.webp', 90, maxw=320)
    n += 1
print(n, 'apercus ecrits,', round(sum(os.path.getsize(f) for f in glob.glob(ROOT + '/*.webp')) / 1024), 'ko')
