import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "data/source/Simple_Quiz_Intelligence_base.xlsx",
  "outputs/Simple_Quiz_Intelligence_with_Telegram.xlsx",
  "outputs/Simple_Quiz_Intelligence_with_Telegram_offline.html",
  "telegram_archive/manifest.json",
  "telegram_archive/questions_enriched.json",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Нет обязательного файла: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync("telegram_archive/manifest.json", "utf8"));
const questions = JSON.parse(
  fs.readFileSync("telegram_archive/questions_enriched.json", "utf8"),
);
const html = fs.readFileSync(
  "outputs/Simple_Quiz_Intelligence_with_Telegram_offline.html",
  "utf8",
);
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) throw new Error("В офлайн-HTML отсутствует встроенный скрипт");
new Function(scriptMatch[1]);

const dataMatch = scriptMatch[1].match(/const DATA=(\{[\s\S]*?\});\n/);
if (!dataMatch) throw new Error("В офлайн-HTML отсутствуют встроенные данные");
const htmlData = JSON.parse(dataMatch[1]);

const mediaFiles = manifest.media.filter((item) => item.file);
for (const item of mediaFiles) {
  const localPath = path.join("telegram_archive", item.file);
  if (!fs.existsSync(localPath)) throw new Error(`Нет медиафайла: ${localPath}`);
}
for (const question of questions.questions) {
  if (!fs.existsSync(question.mediaPath)) {
    throw new Error(`Нет карточки вопроса: ${question.mediaPath}`);
  }
}

const expected = {
  catalog: questions.finalCatalogCount,
  recognized: questions.questionCount,
  added: questions.uniqueAddedToCatalog,
  duplicates: questions.duplicatesSkipped,
  downloaded: mediaFiles.length,
};
for (const [key, value] of Object.entries(expected)) {
  if (htmlData.stats[key] !== value) {
    throw new Error(`Статистика ${key}: HTML=${htmlData.stats[key]}, данные=${value}`);
  }
}

console.log(
  [
    "Проверка пройдена.",
    `Каталог: ${expected.catalog}`,
    `Карточки: ${expected.recognized}`,
    `Новые: ${expected.added}`,
    `Дубликаты: ${expected.duplicates}`,
    `Медиа: ${expected.downloaded}`,
  ].join("\n"),
);
