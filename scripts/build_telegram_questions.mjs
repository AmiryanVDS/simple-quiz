import fs from "node:fs/promises";

const manifest = JSON.parse(await fs.readFile("telegram_archive/manifest.json", "utf8"));
const ocrRows = (await fs.readFile("telegram_archive/ocr_preprocessed.jsonl", "utf8"))
  .trim()
  .split("\n")
  .map(JSON.parse);
const ocrByFile = new Map(ocrRows.map((row) => [row.file, row]));

const captionCue =
  /(вопрос|вопросик|вопросы|разминоч|верс|угада|пошторм|спойлер|думаем|полиглот|киноман|теолог|искусствовед|эксперт|знаток|шарит|минута на обсуждение|квесчен|правильн.*ответ)/i;
const questionCue =
  /(вопрос\s*\d|назовите|напишите|о чем речь|кто\s|какой|какая|какие|почему|воспроизведите|восполните|заполните|угадайте|определите|укажите|ответьте|в форме чего|о каком|каково|чем |где |сколько|выберите|что мы зашифровали|что предложил|что такое|что нарисовал|кому|который из|\?)/i;
const nonQuestionCue =
  /(турнирная таблица|общий зачет|общий зач[её]т|игра \d.*рубл|начало.*\d\d:\d\d)/i;
const forceInclude = new Set([321, 542, 587]);
const forceExclude = new Set([235]);

function fileFor(postId) {
  return `post_${String(postId).padStart(4, "0")}_photo_01.jpg`;
}

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+(?:WIN BOX|@simple_quiz|СИМПЛ КВИЗ)\s*[=—–-]*\s*$/i, "")
    .replace(/^ВОПРОС\s*\d+\s*/i, "")
    .replace(/\s+©\s*$/, "")
    .trim();
}

const questions = [];
for (const post of manifest.posts) {
  if (post.photos.length !== 1 || forceExclude.has(post.id)) continue;
  const file = fileFor(post.id);
  const ocr = ocrByFile.get(file);
  if (!ocr) continue;
  const text = cleanText(ocr.text || "");
  const selected =
    forceInclude.has(post.id) ||
    (text.length >= 70 &&
      ocr.confidence >= 0.7 &&
      !nonQuestionCue.test(text) &&
      questionCue.test(text) &&
      (captionCue.test(post.text || "") || text.length >= 130 || /вопрос\s*\d/i.test(ocr.text || "")));
  if (!selected) continue;
  questions.push({
    postId: post.id,
    date: post.date ? post.date.slice(0, 10) : "",
    question: text,
    answer: "",
    postUrl: post.url,
    mediaPath: `telegram_archive/media/${file}`,
    caption: (post.text || "").replace(/\s+/g, " ").trim(),
    ocrConfidence: Number(ocr.confidence.toFixed(4)),
    reviewStatus:
      ocr.confidence >= 0.9 && text.length >= 100
        ? "Распознано — проверить ответ"
        : "OCR — проверить формулировку",
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headers = [
  "postId",
  "date",
  "question",
  "answer",
  "postUrl",
  "mediaPath",
  "caption",
  "ocrConfidence",
  "reviewStatus",
];
const csv =
  "\ufeff" +
  [headers, ...questions.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvCell).join(";"))
    .join("\n");

await fs.writeFile(
  "telegram_archive/questions.json",
  JSON.stringify(
    {
      channel: manifest.channel,
      extractedAt: new Date().toISOString(),
      questionCount: questions.length,
      note: "Ответы не публиковались на карточках; поля answer оставлены пустыми.",
      questions,
    },
    null,
    2,
  ),
);
await fs.writeFile("telegram_archive/questions.csv", csv);
console.log(`questions: ${questions.length}`);
