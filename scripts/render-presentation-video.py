"""Burn Albanian subtitles into the recorded walkthrough and create a portable MP4."""
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "output" / "prezantimi"
timeline = json.loads((out / "timeline.json").read_text())


def stamp(value):
    centiseconds = round(value * 100)
    return f"{centiseconds // 360000}:{centiseconds // 6000 % 60:02}:{centiseconds // 100 % 60:02}.{centiseconds % 100:02}"


def wrap(text, maximum=92):
    words, lines, line = text.split(), [], ""
    for word in words:
        if len(line) + len(word) + 1 > maximum:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    if line:
        lines.append(line)
    return r"\N".join(lines)


header = """[Script Info]
Title: Shkolla Digjitale ERP — prezantim shqip
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Subtitle,DejaVu Sans,32,&H00FFFFFF,&H00FFFFFF,&H001B1010,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,90,90,24,1
Style: Chapter,DejaVu Sans,19,&H00FFFFFF,&H00FFFFFF,&H00270808,&H00270808,0,0,0,0,100,100,0.5,0,3,9,0,8,600,400,24,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events = []
for cue in timeline["cues"]:
    events.append(f"Dialogue: 1,{stamp(cue['from'])},{stamp(cue['to'])},Subtitle,,0,0,0,,{wrap(cue['text'])}")
for chapter in timeline["chapters"]:
    events.append(f"Dialogue: 0,{stamp(chapter['from'])},{stamp(chapter['to'])},Chapter,,0,0,0,,{chapter['title']}")
ass = out / "titra-shqip.ass"
ass.write_text(header + "\n".join(events) + "\n")
# Store chapter metadata inside the MP4 for compatible media players.
metadata = [";FFMETADATA1", "title=Shkolla Digjitale ERP — prezantimi dhe përdorimi", "comment=Ndërfaqe reale, API reale dhe të dhëna sintetike. Titra shqip të integruar në figurë."]
for chapter in timeline["chapters"]:
    metadata += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={round(chapter['from'] * 1000)}", f"END={round(chapter['to'] * 1000)}", f"title={chapter['title']}"]
meta = out / "kapituj.ffmeta"
meta.write_text("\n".join(metadata) + "\n")
video = out / "Shkolla-Digjitale-ERP-Prezantimi.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-y", "-i", timeline["rawPath"], "-i", str(meta), "-map_metadata", "1", "-map_chapters", "1", "-t", str(timeline["cues"][-1]["to"] + 0.6), "-vf", f"scale=1920:960:flags=lanczos,pad=1920:1080:0:0:color=0x080827,subtitles={ass}", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-threads", "4", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(video)], check=True)
print(video)
