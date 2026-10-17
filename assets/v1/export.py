"""Deterministic sprite extraction + articulated pixel-frame export. Python 3 / Pillow.
Sources are original generated sprite art, never screenshots. No network at export/runtime.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math, json, hashlib
ROOT=Path(__file__).resolve().parent
CELL=96
NEAREST=Image.Resampling.NEAREST

def source(name):
    return Image.open(ROOT/'source'/name).convert('RGBA')
def crop_cell(im,col,row):
    w,h=im.width//4,im.height//4
    p=im.crop((col*w,row*h,(col+1)*w,(row+1)*h))
    # Alpha-bound crop only; never derive transparency from black RGB pixels.
    return p.crop(p.getbbox())
def fit(im,w,h):
    im=im.copy();im.thumbnail((w,h),Image.Resampling.LANCZOS)
    # Final pixel grid is deliberate; no runtime filtering.
    return im

def actor_frame(base,state,f,n,direction):
    out=Image.new('RGBA',(CELL,CELL)); phase=2*math.pi*f/n
    x=(CELL-base.width)//2;y=83-base.height
    if state=='walk':
        split=int(base.height*.62);upper=base.crop((0,0,base.width,split));lower=base.crop((0,split,base.width,base.height))
        # Articulated lower limbs alternate, torso bobs. Fixed foot anchor.
        for half in range(2):
            leg=lower.crop((half*lower.width//2,0,(half+1)*lower.width//2,lower.height))
            stride=round(math.sin(phase+half*math.pi)*4)
            out.alpha_composite(leg,(x+half*lower.width//2+stride//2,y+split+stride))
        out.alpha_composite(upper,(x,y-round(abs(math.sin(phase))*2)))
    elif state=='death':
        t=f/(n-1);body=base.rotate((-1 if direction==2 else 1)*t*80,NEAREST,expand=True)
        body=body.resize((max(1,round(body.width*(1-t*.12))),max(1,round(body.height*(1-t*.52)))),NEAREST)
        out.alpha_composite(body,((CELL-body.width)//2,85-body.height))
    elif state=='attack':
        recoil=round(math.sin(math.pi*f/n)*4);dx=[-recoil,0,recoil,0][direction];dy=[0,-recoil,0,recoil][direction]
        # Upper body and weapon recoil independently of grounded boots.
        split=int(base.height*.65)
        out.alpha_composite(base.crop((0,split,base.width,base.height)),(x,y+split))
        out.alpha_composite(base.crop((0,0,base.width,split)),(x+dx,y+dy))
    elif state=='hit':
        out.alpha_composite(base,(x+[-2,2,0][f],y))
        if f==0:
            tint=Image.new('RGBA',out.size,(220,55,60,0));tint.putalpha(out.getchannel('A').point(lambda a:a//3));out=Image.alpha_composite(out,tint)
    else:
        # Shoulder breathing is local, not translation of the whole rigid sprite.
        split=int(base.height*.6);body=base.crop((0,0,base.width,split));dy=round(math.sin(phase))
        out.alpha_composite(base.crop((0,split,base.width,base.height)),(x,y+split));out.alpha_composite(body,(x,y+dy))
    return out

actors=source('actors.png');env=source('environment.png')
manifest={'version':1,'license':'Original project art; generated for RIFT SALVAGE. No third-party game assets.','source':['source/actors.png','source/environment.png'],'pipeline':'python3 assets/v1/export.py (Pillow 12.3.0)','cell':[96,96],'orientation':['east','south','west','north'],'anchor':[48,83],'bounds':[0,0,96,96],'shadow':'runtime ellipse at foot anchor; not baked','actors':{},'environment':{}}
for row,kind in enumerate(['hero','guard','brute','crawler']):
    counts={'idle':4,'walk':8 if kind=='hero' else 6,'attack':5 if kind=='brute' else 4,'hit':3,'death':6 if kind in ['hero','brute'] else 5}
    durations={'idle':1000,'walk':280,'attack':260,'hit':210,'death':560}
    frames=[];states={}
    bases=[fit(crop_cell(actors,d,row),83 if row==2 else 75,77 if row==2 else 73) for d in range(4)]
    for state,n in counts.items():
        states[state]={'start':len(frames),'frames':n,'durationMs':durations[state],'loop':state in ['idle','walk']}
        for d in range(4):
            for f in range(n):frames.append(actor_frame(bases[d],state,f,n,d))
    atlas=Image.new('RGBA',(8*CELL,math.ceil(len(frames)/8)*CELL))
    for i,im in enumerate(frames):atlas.alpha_composite(im,((i%8)*CELL,(i//8)*CELL))
    atlas.save(ROOT/(kind+'.png'),optimize=True)
    manifest['actors'][kind]={'file':kind+'.png','size':list(atlas.size),'columns':8,'frameCount':len(frames),'states':states}
# Environment atlas: 12 connected floor variants + 16 wall adjacency masks + 8 props.
frames=[]
for i in range(12):
    # Fill cell continuously: source outer frame removed to avoid repeated toy-box borders.
    src=crop_cell(env,[0,0,1,2,0,1,0,2,3,0,1,2][i],0)
    inset=40;src=src.crop((inset,inset,src.width-inset,src.height-inset)).resize((96,96),Image.Resampling.LANCZOS)
    solid=Image.new('RGBA',(96,96),'#23313b');solid.alpha_composite(src);src=solid
    if i%3==1:src=src.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if i%3==2:src=src.transpose(Image.Transpose.ROTATE_180)
    d=ImageDraw.Draw(src);d.line((0,95,95,95),fill='#09141c',width=2);d.line((95,0,95,95),fill='#09141c',width=2)
    for x,y in [(4,4),(89,4),(4,89),(89,89)]:d.rectangle((x,y,x+2,y+2),fill='#8e9b9e')
    if i in [4,6,9]:
        for k in range(12):
            x=(i*19+k*37)%88;y=(i*41+k*17)%88;d.line((x,y,x+5,y),fill='#31424a')
    frames.append(src)
for mask in range(16):
    src=crop_cell(env,[0,1,3,0][mask%4],1).resize((96,96),Image.Resampling.LANCZOS)
    d=ImageDraw.Draw(src)
    for bit,box in enumerate([(0,0,95,5),(90,0,95,95),(0,90,95,95),(0,0,5,95)]):
        if mask&(1<<bit):d.rectangle(box,fill='#849093');d.rectangle(tuple([box[0]+1,box[1]+1,box[2],box[3]]),outline='#253540')
    frames.append(src)
props=['crate','stack','barrel','terminal','tank','cache','gate','pipe']
for i,name in enumerate(props):
    src=fit(crop_cell(env,i%4,2+i//4),90,90)
    frame=Image.new('RGBA',(96,96));frame.alpha_composite(src,((96-src.width)//2,92-src.height));frames.append(frame)
    manifest['environment'][name]={'index':len(frames)-1,'collision':'map cell 2 only' if name in ['crate','stack','barrel','tank','pipe'] else 'passable interactable','anchor':[48,92]}
atlas=Image.new('RGBA',(8*CELL,math.ceil(len(frames)/8)*CELL))
for i,im in enumerate(frames):atlas.alpha_composite(im,(i%8*CELL,i//8*CELL))
atlas.save(ROOT/'environment.png',optimize=True)
manifest['terrain']={'file':'environment.png','size':list(atlas.size),'columns':8,'floor':[0,12],'wall':[12,16],'wallMask':'N=1 E=2 S=4 W=8; adjacent passable cells','propsStart':28}
for f in ['hero.png','guard.png','brute.png','crawler.png','environment.png']:manifest.setdefault('sha256',{})[f]=hashlib.sha256((ROOT/f).read_bytes()).hexdigest()
from export_themes import augment
manifest=augment(manifest)
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Exported',sum((ROOT/f).stat().st_size for f in manifest['sha256']),'runtime bytes')
