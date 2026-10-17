"""Make compact CSS-resolution review copies of actual browser screenshots."""
from pathlib import Path
from PIL import Image
from io import BytesIO
import sys

root = Path(__file__).resolve().parent / 'evidence'
def export(image, name):
    data = BytesIO()
    image.save(data, format='WEBP', lossless=True)
    target = root / f'{name}.webp'
    temporary = root / f'{name}.webp.tmp'
    temporary.write_bytes(data.getvalue())
    temporary.replace(target)
names = ['mining', 'firefight', 'brute', 'extraction', 'return']
names += [f'layout-{w}' for w in [320, 375, 390, 430, 844]]
names += [f'{prefix}-{i}' for prefix in ['theme', 'normal-theme'] for i in range(3)]
if '--orbit-only' in sys.argv:
    names = []
for name in names:
    source = root / f'{name}.png'
    if not source.exists():
        raise FileNotFoundError(source)
    with Image.open(source) as image:
        export(image.resize((image.width // 2, image.height // 2), Image.Resampling.LANCZOS), name)
for name in ['orbit-flight', 'orbit-astra', 'orbit-refit', 'orbit-eden', 'three-idle', 'three-turn', 'three-boost']:
    with Image.open(root / f'{name}.png') as image:
        export(image, name)
frames = []
for i in range(8):
    with Image.open(root / f'thruster-frame-{i}.png') as image:
        frames.append(image.convert('RGB').quantize(colors=96))
data = BytesIO()
frames[0].save(data, format='GIF', save_all=True, append_images=frames[1:],
               duration=[300,160,160,240,160,160,160,300], loop=0)
temporary = root / 'thrusters.gif.tmp'
temporary.write_bytes(data.getvalue())
temporary.replace(root / 'thrusters.gif')
