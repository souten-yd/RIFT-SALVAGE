"""Make compact CSS-resolution review copies of actual browser screenshots."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent / 'evidence'
names = ['mining', 'firefight', 'brute', 'extraction', 'return']
names += [f'layout-{w}' for w in [320, 375, 390, 430, 844]]
names += [f'{prefix}-{i}' for prefix in ['theme', 'normal-theme'] for i in range(3)]
for name in names:
    source = root / f'{name}.png'
    if not source.exists():
        raise FileNotFoundError(source)
    with Image.open(source) as image:
        image.resize((image.width // 2, image.height // 2), Image.Resampling.LANCZOS).save(
            root / f'{name}.webp', lossless=True)
