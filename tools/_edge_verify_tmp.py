import json, subprocess, tempfile, os, re, difflib
T="/home/ai-mac/Desktop/AI_MAC/tools"
A="/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab/audio"
def edge_norm(t): return t.replace("="," 等於 ").replace("×"," 乘以 ")
def norm(t): return re.sub(r"[,，。.!！?？:：、;；\s「」——…\-]","",t).lower()
def stt(mp3):
    wav=tempfile.mktemp(suffix=".wav")
    subprocess.run([f"{T}/ffmpeg/ffmpeg","-y","-i",mp3,"-ar","16000","-ac","1",wav],capture_output=True)
    r=subprocess.run([f"{T}/whisper.cpp/build/bin/whisper-cli","-m",f"{T}/whisper.cpp/models/ggml-small.bin","-l","zh","-nt","-np","-f",wav],capture_output=True,text=True,timeout=600)
    os.unlink(wav); return r.stdout.strip()
caps=json.load(open("tools/captions.json",encoding="utf8"))
flagged=[]
for e in caps:
    p=f"{A}/{e['id']}_{e['i']}.mp3"
    if not os.path.exists(p): print("MISSING",e['id'],e['i']); continue
    exp=edge_norm(e['cap']); heard=stt(p)
    toks=re.findall(r'\d+|[xXyY]|平方|等於|乘以|負', exp)
    miss=[tk for tk in toks if norm(tk) not in norm(heard)]
    if miss: flagged.append((e['id'],e['i'],miss,heard))
    print(f"{e['id']}_{e['i']} miss={miss}",flush=True)
print("\n=== FLAGGED (關鍵token遺漏) ===")
for id,i,miss,heard in flagged: print(f"{id}_{i} miss={miss}\n  聽:{heard}")
print(f"\n總 {len(caps)} 句, flagged {len(flagged)}")
