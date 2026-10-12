"""重製教育部字形與音檔：python scripts/convert-moe.py 已解壓的官方素材資料夾
需 ffmpeg；使用官方 license.txt、audio/F1.WAV–F37.WAV 與 Unicode JSON 筆畫。
"""
from pathlib import Path
import sys,json,subprocess,shutil
source=Path(sys.argv[1]);root=Path(__file__).resolve().parents[1]/'public'
for i in range(37):
    sid=f's{i+1:02d}'
    strokes=json.loads(next(source.rglob(f'{0x3105+i:x}.json')).read_text())
    paths=[]
    for stroke in strokes:
        commands=[]
        for c in stroke['outline']:
            t=c['type']
            if t in ['M','L']:commands.append(f'{t}{c["x"]} {c["y"]}')
            elif t=='Q':commands.append(f'Q{c["begin"]["x"]} {c["begin"]["y"]} {c["end"]["x"]} {c["end"]["y"]}')
            elif t=='C':commands.append(f'C{c["begin"]["x"]} {c["begin"]["y"]} {c["mid"]["x"]} {c["mid"]["y"]} {c["end"]["x"]} {c["end"]["y"]}')
            else:raise ValueError('未知筆畫指令')
        paths.append('<path d="'+' '.join(commands)+' Z"/>')
    (root/'glyphs'/f'{sid}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2050 2050" fill="#203E36">'+''.join(paths)+'</svg>')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source/'audio'/f'F{i+1}.WAV'),'-ac','1','-ar','44100','-b:a','96k',str(root/'audio/symbols'/f'{sid}.mp3')],check=True)
shutil.copy(next(source.rglob('license.txt')),root/'licenses/moe.txt')
print('37 字形與音檔完成；仍須人工聽校')
