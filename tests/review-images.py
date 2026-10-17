"""Make compact CSS-resolution review copies of actual browser screenshots."""
from pathlib import Path
from PIL import Image
from io import BytesIO

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
for name in names:
    source = root / f'{name}.png'
    if not source.exists():
        raise FileNotFoundError(source)
    with Image.open(source) as image:
        export(image.resize((image.width // 2, image.height // 2), Image.Resampling.LANCZOS), name)
for name in ['orbit-flight', 'orbit-astra', 'orbit-refit', 'orbit-eden', 'larger-ground']:
    with Image.open(root / f'{name}.png') as image:
        export(image, name)
