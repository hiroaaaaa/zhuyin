"""重製 UI 字型子集：python scripts/subset-fonts.py Regular.otf Bold.otf
需 pip install fonttools brotli；保留 Noto OFL 及字型原作者聲明。
"""
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
root = Path(__file__).resolve().parents[1]
text = ''.join(p.read_text() for p in (root/'src').rglob('*') if p.suffix in ['.tsx','.ts'])
text += ''.join(chr(i) for i in range(32,127))
for label, source in zip(['Regular','Bold'],sys.argv[1:]):
    font = TTFont(source)
    options = subset.Options()
    options.desubroutinize = True
    worker = subset.Subsetter(options=options)
    worker.populate(text=text)
    worker.subset(font)
    font.flavor = 'woff2'
    font.save(root/'public/fonts'/f'NotoSansTC-{label}-UI.woff2')
    print(label,'UI 子集完成')
