import fs from "node:fs/promises";

const source = JSON.parse(
  await fs.readFile("data/source/Simple_Quiz_Intelligence_base.json", "utf8"),
);
const archive = JSON.parse(
  await fs.readFile("telegram_archive/questions.json", "utf8"),
);
const analysisRows = (
  await fs.readFile("telegram_archive/question_analysis.tsv", "utf8")
)
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [
      postId,
      mechanic,
      areas,
      solutionChain,
      difficulty,
      repeatability,
    ] = line.split("\t");
    return {
      postId: Number(postId),
      mechanic,
      areas,
      solutionChain,
      difficulty: Number(difficulty),
      repeatability,
    };
  });
const analysisByPost = new Map(
  analysisRows.map((analysis) => [analysis.postId, analysis]),
);

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
  for (const [gram, value] of a) {
    intersection += Math.min(value, b.get(gram) || 0);
  }
  return (2 * intersection) / (aSize + bSize || 1);
}

const existingQuestions = source.sheets["Каталог"].rows.map((row) => ({
  id: row[0],
  question: row[4],
  answer: row[5],
  mechanic: row[6],
  areas: row[7],
  solutionChain: row[8],
  difficulty: row[9],
  repeatability: row[10],
}));

const enriched = archive.questions.map((question) => {
  let best = { score: 0, row: null };
  for (const existing of existingQuestions) {
    const score = similarity(question.question, existing.question);
    if (score > best.score) best = { score, row: existing };
  }
  const duplicate = best.score >= 0.9 ? best.row : null;
  const analysis = duplicate || analysisByPost.get(question.postId);
  if (!analysis) {
    throw new Error(`Нет анализа для Telegram-поста ${question.postId}`);
  }
  return {
    ...question,
    duplicateOfId: duplicate?.id || "",
    duplicateScore: Number(best.score.toFixed(4)),
    answer: question.answer || duplicate?.answer || "",
    catalogId: "",
    mechanic: analysis.mechanic,
    areas: analysis.areas,
    solutionChain: analysis.solutionChain,
    difficulty: analysis.difficulty,
    repeatability: analysis.repeatability,
    reviewStatus:
      analysis.mechanic === "Служебная карточка — не вопрос"
        ? "Служебная карточка — проверить исключение"
        : question.reviewStatus,
  };
});

const uniqueQuestions = enriched.filter((question) => !question.duplicateOfId);
const firstNewId =
  Math.max(...existingQuestions.map((row) => Number(row.id) || 0)) + 1;
uniqueQuestions.forEach((question, index) => {
  question.catalogId = firstNewId + index;
});

await fs.writeFile(
  "telegram_archive/questions_enriched.json",
  JSON.stringify(
    {
      ...archive,
      uniqueAddedToCatalog: uniqueQuestions.length,
      duplicatesSkipped: enriched.length - uniqueQuestions.length,
      finalCatalogCount: existingQuestions.length + uniqueQuestions.length,
      analyzedQuestionCount: enriched.length,
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
    catalogCount: existingQuestions.length + uniqueQuestions.length,
    analyzed: enriched.length,
  }),
);
