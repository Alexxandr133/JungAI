# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(r"c:\Users\saw15\Desktop\TECHdiasoft\Project\JingAI\frontend\src\pages\room\VoiceRoom.tsx")
text = p.read_bytes().decode("utf-8")
text = text.replace("вЂ“", "–").replace("В·", "·").replace("вЂ¦", "…")
p.write_bytes(text.encode("utf-8"))
print("done", "В·" in text, "вЂ" in text)
