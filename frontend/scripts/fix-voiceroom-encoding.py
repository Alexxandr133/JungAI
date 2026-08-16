# -*- coding: utf-8 -*-
"""Fix VoiceRoom.tsx mojibake (UTF-8 misread as cp1251) and rewrite pre-join title."""
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "src" / "pages" / "room" / "VoiceRoom.tsx"
text = p.read_bytes().decode("utf-8")

def try_fix_line(line: str) -> str:
    if not any(ord(c) > 127 for c in line):
        return line
    # Skip lines that already look correct (contain common Russian words as proper UTF-8)
    # Detect mojibake: high density of "Р" followed by capital Cyrillic or C2 B7 middle-dot artifacts
    if "Р" not in line and "В·" not in line and "вЂ" not in line:
        return line
    try:
        cand = line.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return line
    # Accept if round-trip produces more lowercase Cyrillic letters typical of Russian prose
    def score(s: str) -> int:
        return sum(1 for c in s if "а" <= c <= "я" or c in "ё")

    if score(cand) > score(line):
        return cand
    return line

fixed_lines = [try_fix_line(line) for line in text.splitlines(True)]
fixed = "".join(fixed_lines)

replacement = '''function formatMeetingLine(ev: EventData): string {
    const start = new Date(ev.startsAt);
    const now = new Date();
    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
    const time = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const when = sameDay
      ? `сегодня, ${time}`
      : start.toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    const typeLabel =
      ev.type === 'session'
        ? 'Сессия'
        : ev.type === 'video' || ev.type === 'call'
          ? 'Видеовстреча'
          : ev.type === 'supervision'
            ? 'Супервизия'
            : ev.type === 'webinar'
              ? 'Вебинар'
              : (ev.title?.trim() || 'Встреча');
    const name = (ev.hostName || '').trim() || 'специалист';
    return `${typeLabel} · ${name} · ${when}`;
  }'''

fixed2, n = re.subn(
    r"function formatMeetingLine\(ev: EventData\): string \{[\s\S]*?\n  \}",
    replacement,
    fixed,
    count=1,
)
print("formatMeetingLine replaced:", n)

# Verify key strings
checks = ["Сессия", "Камера", "Подключиться", "Участник", "Быстрый"]
for c in checks:
    print(c, "OK" if c.encode("utf-8") in fixed2.encode("utf-8") else "MISSING")

# Spot-check no mojibake in meeting line
i = fixed2.find("return `${typeLabel}")
print("meeting return:", repr(fixed2[i : i + 60]))

p.write_bytes(fixed2.encode("utf-8"))
print("wrote", p)
