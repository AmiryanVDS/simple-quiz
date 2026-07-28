import { readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const inputDir = process.argv[2] || "telegram_archive/media";
const outputFile = process.argv[3] || "telegram_archive/ocr.jsonl";
const concurrency = Math.max(1, Number(process.argv[4] || 6));
const pageSegmentationMode = String(process.argv[5] || "6");
const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);
const files = (await readdir(inputDir))
  .filter((file) => allowed.has(path.extname(file).toLowerCase()))
  .sort();

function runTesseract(file) {
  return new Promise((resolve) => {
    const child = spawn(
      "/opt/homebrew/bin/tesseract",
      [path.join(inputDir, file), "stdout", "-l", "rus+eng", "--psm", pageSegmentationMode, "tsv"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ file, text: "", confidence: 0, error: stderr.trim() || `exit ${code}` });
        return;
      }
      const rows = stdout.split(/\r?\n/).slice(1);
      const words = [];
      let confidenceTotal = 0;
      for (const row of rows) {
        const columns = row.split("\t");
        if (columns.length < 12) continue;
        const confidence = Number(columns[10]);
        const text = columns.slice(11).join("\t").trim();
        if (!text || confidence < 0) continue;
        words.push(text);
        confidenceTotal += confidence;
      }
      resolve({
        file,
        text: words.join(" ").replace(/\s+/g, " ").trim(),
        confidence: words.length ? confidenceTotal / words.length / 100 : 0,
        error: null,
      });
    });
  });
}

const records = new Array(files.length);
let cursor = 0;
let completed = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= files.length) return;
    records[index] = await runTesseract(files[index]);
    completed += 1;
    if (completed % 20 === 0 || completed === files.length) {
      process.stderr.write(`ocr ${completed}/${files.length}\n`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
await writeFile(outputFile, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
