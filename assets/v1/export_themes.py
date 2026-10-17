"""Pack the generated 6x4 transparent prop sheet; preserve supplied alpha.
No background removal, painting, or synthesized replacement artwork.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parent
NAMES = [
    'ore_hopper', 'drill', 'compressor', 'spool', 'tool_chest', 'ore_debris',
    'centrifuge', 'cryo', 'server', 'workbench', 'specimen_case', 'glass_debris',
    'turbine', 'radar', 'ammo_rack', 'reactor', 'salvage_case', 'hull_debris',
    'circuit_loot', 'mineral_loot', 'sample_loot', 'data_loot', 'parts_loot', 'supply_loot',
]

def augment(manifest):
    source = Image.open(ROOT / 'source/themed-props.png').convert('RGBA')
    assert source.width % 6 == 0 and source.height % 4 == 0
    assert source.getchannel('A').getextrema()[0] == 0
    atlas = Image.new('RGBA', (768, 288))
    sprites = {}
    for i, name in enumerate(NAMES):
        x, y = (i % 6) * source.width // 6, (i // 6) * source.height // 4
        cell = source.crop((x, y, x + source.width // 6, y + source.height // 4))
        bounds = cell.getchannel('A').getbbox()
        assert bounds, name
        cell = cell.crop(bounds)
        cell.thumbnail((88, 84), Image.Resampling.LANCZOS)
        atlas.alpha_composite(cell, ((i % 8)*96+(96-cell.width)//2, (i//8)*96+90-cell.height))
        sprites[name] = {'file': 'themed-props.png', 'index': i, 'anchor': [48, 90],
                         'role': 'loot-container' if i >= 18 else 'floor-debris' if i % 6 == 5 else 'physical-cover',
                         'collision': 'existing map only; no added collision or rewards'}
    atlas.save(ROOT / 'themed-props.png', optimize=True)
    manifest['themedProps'] = {'file': 'themed-props.png', 'size': [768, 288], 'columns': 8, 'sprites': sprites}
    manifest['themes'] = [
        {'id': 'mining', 'site': 'ASTRA-9', 'label': 'MINING', 'floor': [22, 29, 33],
         'wall': [32, 36, 37], 'accent': '#d99c4c', 'light': '#ffae59', 'panel': [193, 137],
         'covers': NAMES[0:5], 'debris': NAMES[5], 'loot': NAMES[18:20], 'wallDepth': 20},
        {'id': 'research', 'site': 'VESTA-6', 'label': 'BIO LAB', 'floor': [27, 39, 44],
         'wall': [51, 67, 73], 'accent': '#68c6c9', 'light': '#77dfe6', 'panel': [229, 163],
         'covers': NAMES[6:11], 'debris': NAMES[11], 'loot': NAMES[20:22], 'wallDepth': 17},
        {'id': 'derelict', 'site': 'NEREID-3', 'label': 'DECK', 'floor': [24, 29, 38],
         'wall': [38, 34, 35], 'accent': '#bc7155', 'light': '#fa6957', 'panel': [149, 211],
         'covers': NAMES[12:17], 'debris': NAMES[17], 'loot': NAMES[22:24], 'wallDepth': 22},
    ]
    if 'source/themed-props.png' not in manifest['source']:
        manifest['source'].append('source/themed-props.png')
    manifest['sha256']['themed-props.png'] = hashlib.sha256((ROOT / 'themed-props.png').read_bytes()).hexdigest()
    manifest['terrain']['activeRenderer'] = 'world-space themed floor and exposed wall edge strips; legacy atlas wall cells unused'
    return manifest

if __name__ == '__main__':
    path = ROOT / 'manifest.json'
    path.write_text(json.dumps(augment(json.loads(path.read_text())), indent=2) + '\n')
