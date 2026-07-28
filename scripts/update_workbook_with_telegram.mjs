import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "data/source/Simple_Quiz_Intelligence_base.xlsx";
const outputPath = "outputs/Simple_Quiz_Intelligence_with_Telegram.xlsx";
const rootOutputPath = "Simple_Quiz_Intelligence_v1_rebuilt.xlsx";
const archive = JSON.parse(await fs.readFile("telegram_archive/questions.json", "utf8"));

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/g, "")
    .trim();
}

function trigrams(text) {
  const normalized = normalize(text);
  const map = new Map();
  for (let index = 0; index < normalized.length - 2; index += 1) {
    const gram = normalized.slice(index, index + 3);
    map.set(gram, (map.get(gram) || 0) + 1);
  }
  return map;
}

function similarity(left, right) {
  const a = trigrams(left);
  const b = trigrams(right);
  let aSize = 0;
  let bSize = 0;
  let intersection = 0;
  for (const value of a.values()) aSize += value;
  for (const value of b.values()) bSize += value;
  for (const [gram, value] of a) intersection += Math.min(value, b.get(gram) || 0);
  return (2 * intersection) / (aSize + bSize || 1);
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const catalog = workbook.worksheets.getItem("Каталог");
const catalogTable = catalog.tables.getItem("QuestionsTable");
const existingRows = catalog.getRange("A2:N49").values;
const existingQuestions = existingRows.map((row) => ({
  id: row[0],
  question: row[4],
  answer: row[5],
}));

const enriched = archive.questions.map((question) => {
  let best = { score: 0, row: null };
  for (const existing of existingQuestions) {
    const score = similarity(question.question, existing.question);
    if (score > best.score) best = { score, row: existing };
  }
  const duplicate = best.score >= 0.9 ? best.row : null;
  return {
    ...question,
    duplicateOfId: duplicate?.id || "",
    duplicateScore: Number(best.score.toFixed(4)),
    answer: question.answer || duplicate?.answer || "",
    catalogId: "",
  };
});

const uniqueQuestions = enriched.filter((question) => !question.duplicateOfId);
const firstNewId = Math.max(...existingQuestions.map((row) => Number(row.id) || 0)) + 1;
uniqueQuestions.forEach((question, index) => {
  question.catalogId = firstNewId + index;
});

const catalogRows = uniqueQuestions.map((question, index) => [
  question.catalogId,
  "TG",
  "Telegram-архив",
  index + 1,
  question.question,
  question.answer || "Не опубликован в посте",
  "Не размечено",
  "Спорт / смешанное",
  question.answer
    ? `Ответ подтверждён реакцией канала: ${question.answerSourceUrl}`
    : "OCR из карточки; требуется редакторская проверка",
  null,
  "Не оценена",
  question.mediaPath,
  null,
  question.postUrl,
]);
if (catalogRows.length) catalogTable.rows.add(null, catalogRows);

const catalogLastRow = 1 + existingRows.length + catalogRows.length;
catalog.getRange(`A2:N${catalogLastRow}`).format.verticalAlignment = "top";
catalog.getRange(`E2:I${catalogLastRow}`).format.wrapText = true;
catalog.getRange(`L2:N${catalogLastRow}`).format.wrapText = true;

const telegram = workbook.worksheets.add("Telegram-архив");
telegram.showGridLines = false;
telegram.freezePanes.freezeRows(3);
telegram.getRange("A1:J1").merge();
telegram.getRange("A1").values = [["TELEGRAM-АРХИВ · @simple_quiz"]];
telegram.getRange("A1:J1").format = {
  fill: "#17365D",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
telegram.getRange("A1:J1").format.rowHeight = 30;
telegram.getRange("A2:J2").merge();
telegram.getRange("A2").values = [[
  `130 распознанных карточек; ${uniqueQuestions.length} новых вопросов добавлено в «Каталог», ${enriched.length - uniqueQuestions.length} совпадений отмечено как дубликаты. ${enriched.filter((question) => question.answer).length} ответов заполнено.`,
]];
telegram.getRange("A2:J2").format = {
  fill: "#D9EAF7",
  font: { color: "#17365D", italic: true },
  wrapText: true,
};
telegram.getRange("A2:J2").format.rowHeight = 34;

const headers = [
  "Telegram ID",
  "Дата",
  "Post ID",
  "Текст вопроса",
  "Ответ",
  "Источник",
  "Медиа",
  "OCR",
  "Статус",
  "Дубликат ID",
];
telegram.getRange("A3:J3").values = [headers];
const telegramRows = enriched.map((question) => [
  `TG-${String(question.postId).padStart(4, "0")}`,
  question.date ? new Date(`${question.date}T00:00:00Z`) : null,
  question.postId,
  question.question,
  question.answer || "Не опубликован в посте",
  question.postUrl,
  question.mediaPath,
  question.ocrConfidence,
  question.duplicateOfId ? "Дубликат каталога" : question.reviewStatus,
  question.duplicateOfId || null,
]);
const telegramLastRow = 3 + telegramRows.length;
telegram.getRange(`A4:J${telegramLastRow}`).values = telegramRows;
telegram.getRange(`B4:B${telegramLastRow}`).format.numberFormat = "yyyy-mm-dd";
telegram.getRange(`H4:H${telegramLastRow}`).format.numberFormat = "0.0%";
telegram.getRange(`A3:J${telegramLastRow}`).format.verticalAlignment = "top";
telegram.getRange(`D4:G${telegramLastRow}`).format.wrapText = true;
telegram.getRange(`I4:I${telegramLastRow}`).format.wrapText = true;
telegram.getRange(`A3:J${telegramLastRow}`).format.font = { size: 10 };
telegram.getRange("A3:J3").format.font = { bold: true, color: "#FFFFFF", size: 10 };
telegram.getRange("A3:J3").format.fill = "#244F7D";
telegram.getRange("A3:J3").format.rowHeight = 24;
telegram.getRange(`A4:J${telegramLastRow}`).format.rowHeight = 72;
telegram.getRange(`A4:A${telegramLastRow}`).format.columnWidthPx = 84;
telegram.getRange(`B4:B${telegramLastRow}`).format.columnWidthPx = 88;
telegram.getRange(`C4:C${telegramLastRow}`).format.columnWidthPx = 62;
telegram.getRange(`D4:D${telegramLastRow}`).format.columnWidthPx = 520;
telegram.getRange(`E4:E${telegramLastRow}`).format.columnWidthPx = 170;
telegram.getRange(`F4:F${telegramLastRow}`).format.columnWidthPx = 210;
telegram.getRange(`G4:G${telegramLastRow}`).format.columnWidthPx = 270;
telegram.getRange(`H4:H${telegramLastRow}`).format.columnWidthPx = 65;
telegram.getRange(`I4:I${telegramLastRow}`).format.columnWidthPx = 175;
telegram.getRange(`J4:J${telegramLastRow}`).format.columnWidthPx = 82;
telegram.getRange(`I4:I${telegramLastRow}`).dataValidation = {
  rule: {
    type: "list",
    values: [
      "Распознано — проверить ответ",
      "OCR — проверить формулировку",
      "Дубликат каталога",
      "Ответ подтверждён реакцией канала",
      "Проверено",
    ],
  },
};
telegram.getRange(`I4:I${telegramLastRow}`).conditionalFormats.add("containsText", {
  text: "Дубликат",
  format: { fill: "#E2E8F0", font: { color: "#475569" } },
});
telegram.getRange(`I4:I${telegramLastRow}`).conditionalFormats.add("containsText", {
  text: "OCR",
  format: { fill: "#FDE68A", font: { color: "#854D0E" } },
});
telegram.getRange(`I4:I${telegramLastRow}`).conditionalFormats.add("containsText", {
  text: "Распознано",
  format: { fill: "#DCFCE7", font: { color: "#166534" } },
});
const telegramTable = telegram.tables.add(`A3:J${telegramLastRow}`, true, "TelegramQuestionsTable");
telegramTable.style = "TableStyleMedium2";

const dashboard = workbook.worksheets.getItem("Дашборд");
dashboard.getRange("A1").values = [["SIMPLE QUIZ INTELLIGENCE — база + Telegram"]];
dashboard.getRange("B5").formulas = [["=COUNTA('Каталог'!$A$2:$A$500)"]];
dashboard.getRange("B6").formulas = [["=COUNTA('Раунды'!$A$2:$A$100)"]];
dashboard.getRange("B7").formulas = [["=AVERAGE('Каталог'!$J$2:$J$500)"]];
dashboard.getRange("B8").formulas = [["=COUNTA('Механики'!$A$2:$A$200)"]];
dashboard.getRange("B11").formulas = [["=COUNTIF('Каталог'!$K$2:$K$500,A11)"]];
dashboard.getRange("B11:B13").fillDown();
dashboard.getRange("B17").formulas = [[
  "=AVERAGEIF('Каталог'!$C$2:$C$500,A17,'Каталог'!$J$2:$J$500)",
]];
dashboard.getRange("B17:B24").fillDown();

await fs.mkdir("outputs", { recursive: true });
await fs.copyFile(inputPath, "outputs/Simple_Quiz_Intelligence_before_Telegram.xlsx");
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await output.save(rootOutputPath);

await fs.writeFile(
  "telegram_archive/questions_enriched.json",
  JSON.stringify(
    {
      ...archive,
      uniqueAddedToCatalog: uniqueQuestions.length,
      duplicatesSkipped: enriched.length - uniqueQuestions.length,
      finalCatalogCount: existingRows.length + uniqueQuestions.length,
      questions: enriched,
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify({
    recognized: enriched.length,
    added: uniqueQuestions.length,
    duplicates: enriched.length - uniqueQuestions.length,
    catalogCount: existingRows.length + uniqueQuestions.length,
    outputPath,
  }),
);
