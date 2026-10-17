"""Validate and package the exact dependency closure, never source art or tests."""
from pathlib import Path
import json, hashlib, shutil, re
root=Path(__file__).resolve().parents[1];m=json.loads((root/'assets/v1/manifest.json').read_text())
assert len(m['actors'])==4 and m['terrain']['floor'][1]>=8 and m['terrain']['wall'][1]>=8
for kind,a in m['actors'].items():
    assert set(a['states'])=={'idle','walk','attack','hit','death'}
    assert all(v['frames']>=3 for v in a['states'].values())
for name,sha in m['sha256'].items():
    assert hashlib.sha256((root/'assets/v1'/name).read_bytes()).hexdigest()==sha,name
size=sum((root/'assets/v1'/f).stat().st_size for f in m['sha256'])
assert size<8*1024*1024
html=(root/'index.html').read_text();assert 'rift-salvage-save-v1' in html
assert not re.search(r'<script[^>]+src=["\']https?://',html)
out=root/'_site';shutil.rmtree(out,ignore_errors=True);(out/'assets/v1').mkdir(parents=True)
shutil.copy2(root/'index.html',out/'index.html')
for name in ['manifest.json',*m['sha256']]:shutil.copy2(root/'assets/v1'/name,out/'assets/v1'/name)
(out/'.nojekyll').touch()
for i,script in enumerate(re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>',html,re.S|re.I)):
    import subprocess
    subprocess.run(['node','--check'],input=script,text=True,check=True,capture_output=True)
print(f'PASS: exact static closure; {size} runtime image bytes; sprite states and hashes; JS syntax')
