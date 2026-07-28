import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "outputs/Simple_Quiz_Intelligence_with_Telegram.xlsx";
const previewDir = "/tmp/simple-quiz-workbook-previews";
const workbook = await SpreadsheetFile.importXlsx(
  await FileBlob.load(workbookPath),
);

const keyRange = await workbook.inspect({
  kind: "region",
  sheetId: "Telegram-архив",
  range: "A1:J12",
  maxChars: 5000,
});
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});

await fs.mkdir(previewDir, { recursive: true });
const previews = [
  ["Дашборд", "A1:H25"],
  ["Каталог", "A1:N15"],
  ["Telegram-архив", "A1:J15"],
  ["Механики", "A1:H15"],
  ["Раунды", "A1:H15"],
  ["Новые пакеты", "A1:H15"],
];

for (const [sheetName, range] of previews) {
  const preview = await workbook.render({
    sheetName,
    range,
    scale: 0.8,
    format: "png",
  });
  const safeName = sheetName.replaceAll(" ", "_");
  await fs.writeFile(
    path.join(previewDir, `${safeName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

console.log(keyRange.ndjson);
console.log(formulaErrors.ndjson);
console.log(previewDir);
