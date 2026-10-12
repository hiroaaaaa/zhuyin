"""建置階段產生固定臺灣華語音檔；不接收幼兒資料。需 edge-tts、ffmpeg。
合成音檔仍需兩位教學者聽校，不能以此腳本代替人工驗收。
"""
import asyncio, json, os, subprocess, hashlib
from pathlib import Path
import edge_tts
import edge_tts.communicate
if os.environ.get('CODEX_PROXY_CERT'):
 edge_tts.communicate._SSL_CTX.load_verify_locations(os.environ['CODEX_PROXY_CERT'])

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/advanced'
phrases = {
 'train-help':'聽完整的聲音，再依序點注音，放進小火車。',
 'detective-help':'聽完整的聲音，找出問號那一格應該放的注音。',
 'repair-help':'問號框裡的注音放錯了。聽完整聲音，再找一張正確的注音。',
 'shop-help':'看注音訂單，照順序點圖片，放進小籃子。',
 'tone-help':'聽一聽，點出相同聲調的氣球。',
 'tone-sequence':'先聽兩個聲音，再照順序點聲調氣球。',
 'tone-last':'聽完整詞語，最後一個字，是哪一種聲調？',
 'memory-help':'每次翻兩張，找出字卡和聲音，或圖片和詞語的配對。',
 'route-start':'小兔站在', 'route-ready':'聽清楚路線，聲音說完，再點格子。',
 'first':'先', 'then':'再', 'last':'最後',
 'move-up':'往上走一格', 'move-down':'往下走一格',
 'move-left':'往左走一格', 'move-right':'往右走一格',
 'move-ul':'往左上走一格', 'move-ur':'往右上走一格',
 'move-dl':'往左下走一格', 'move-dr':'往右下走一格',
 'teach-tone-1':'第一聲，湯。', 'teach-tone-2':'第二聲，糖。',
 'teach-tone-3':'第三聲，躺。', 'teach-tone-4':'第四聲，燙。',
 'teach-tone-5':'輕聲，帽子的子，讀得較輕、較短。帽子。',
}
words = {'cat':'貓','chicken':'雞','melon':'瓜','flower':'花','fish':'魚','cow':'牛','ball':'球','horse':'馬','dog':'狗','rabbit':'兔','tree':'樹','bean':'豆','book':'書','pig':'豬','car':'車','bun':'包','cup':'杯','mountain':'山'}
samples={'tang1':'湯','tang2':'糖','tang3':'躺','tang4':'燙','banana':'香蕉','tea':'紅茶','puppy':'小狗','white-rabbit':'白兔','hat':'帽子'}
phrases.update({'word-'+k:v for k,v in words.items()})
phrases.update({'tone-'+k:v for k,v in samples.items()})

async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 semaphore=asyncio.Semaphore(3)
 async def one(key,text):
  dest=OUT/(key+'.mp3')
  if dest.exists() and dest.stat().st_size>1000: return
  async with semaphore:
   raw=OUT/(key+'.raw.mp3')
   for attempt in range(3):
    try:
     await edge_tts.Communicate(text,'zh-TW-HsiaoChenNeural',rate='-12%',proxy=os.environ.get('https_proxy')).save(str(raw))
     subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af','loudnorm=I=-19:TP=-2:LRA=7','-ar','44100','-ac','1','-b:a','96k',str(dest)],check=True)
     raw.unlink(); print(key,flush=True); return
    except Exception:
     if attempt==2: raise
 await asyncio.gather(*(one(k,v) for k,v in phrases.items()))
 metadata={'voice':'zh-TW-HsiaoChenNeural','rate':'-12%','review':'合成試玩素材；待兩位臺灣華語教學者人工聽校','phrases':phrases,'sha256':{k:hashlib.sha256((OUT/(k+'.mp3')).read_bytes()).hexdigest() for k in phrases}}
 (OUT/'texts.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
 print(f'完成 {len(phrases)} 個固定音檔',flush=True)
asyncio.run(main())
