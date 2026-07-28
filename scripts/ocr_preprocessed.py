#!/usr/bin/env python3
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image, ImageEnhance, ImageOps


INPUT_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "telegram_archive/media")
OUTPUT_FILE = Path(sys.argv[2] if len(sys.argv) > 2 else "telegram_archive/ocr_preprocessed.jsonl")
WORKERS = int(sys.argv[3] if len(sys.argv) > 3 else "6")
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
TESSERACT = "/opt/homebrew/bin/tesseract"


def recognize(source: Path, temp_dir: Path) -> dict:
    preprocessed = temp_dir / f"{source.stem}.png"
    try:
        with Image.open(source) as image:
            image = ImageOps.autocontrast(image.convert("L"))
            image = ImageEnhance.Contrast(image).enhance(1.2)
            image = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
            image.save(preprocessed, optimize=True)
        result = subprocess.run(
            [TESSERACT, str(preprocessed), "stdout", "-l", "rus+eng", "--psm", "6", "tsv"],
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode:
            return {"file": source.name, "text": "", "confidence": 0, "error": result.stderr.strip()}
        words = []
        confidence_total = 0.0
        for line in result.stdout.splitlines()[1:]:
            columns = line.split("\t")
            if len(columns) < 12:
                continue
            try:
                confidence = float(columns[10])
            except ValueError:
                continue
            text = "\t".join(columns[11:]).strip()
            if text and confidence >= 0:
                words.append(text)
                confidence_total += confidence
        return {
            "file": source.name,
            "text": " ".join(words),
            "confidence": confidence_total / len(words) / 100 if words else 0,
            "error": None,
        }
    except Exception as error:
        return {"file": source.name, "text": "", "confidence": 0, "error": str(error)}
    finally:
        try:
            preprocessed.unlink()
        except FileNotFoundError:
            pass


files = sorted(path for path in INPUT_DIR.iterdir() if path.suffix.lower() in ALLOWED)
records = {}
completed = 0

with tempfile.TemporaryDirectory(prefix="simple_quiz_ocr_") as directory:
    temp_dir = Path(directory)
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(recognize, source, temp_dir): source for source in files}
        for future in concurrent.futures.as_completed(futures):
            record = future.result()
            records[record["file"]] = record
            completed += 1
            if completed % 20 == 0 or completed == len(files):
                print(f"ocr {completed}/{len(files)}", file=sys.stderr)

OUTPUT_FILE.write_text(
    "\n".join(json.dumps(records[path.name], ensure_ascii=False) for path in files) + "\n",
    encoding="utf-8",
)
