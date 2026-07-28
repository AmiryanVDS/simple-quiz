import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "data/source/Simple_Quiz_Intelligence_base.json",
  "outputs/Simple_Quiz_Intelligence_with_Telegram_offline.html",
  "Simple_Quiz_Intelligence_v1_offline.html",
  "outputs/Simple_Quiz_Team_Training.html",
  "Simple_Quiz_Team_Training.html",
  "telegram_archive/manifest.json",
  "telegram_archive/question_analysis.tsv",
  "telegram_archive/questions_enriched.json",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Нет обязательного файла: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync("telegram_archive/manifest.json", "utf8"));
const questions = JSON.parse(
  fs.readFileSync("telegram_archive/questions_enriched.json", "utf8"),
);
const source = JSON.parse(
  fs.readFileSync("data/source/Simple_Quiz_Intelligence_base.json", "utf8"),
);
const analysisRows = fs
  .readFileSync("telegram_archive/question_analysis.tsv", "utf8")
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
const likedRows = fs
  .readFileSync("telegram_archive/channel_liked_comments.tsv", "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [postId, status, likedIds = ""] = line.split("\t");
    return {
      postId: Number(postId),
      status,
      likedIds: likedIds
        .split(",")
        .filter(Boolean)
        .map(Number),
    };
  });
const likedByPost = new Map(likedRows.map((row) => [row.postId, row]));
const verifiedAnswers = fs
  .readFileSync("telegram_archive/verified_answers.tsv", "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [postId, commentId, ...answerParts] = line.split("\t");
    return {
      postId: Number(postId),
      commentId: Number(commentId),
      answer: answerParts.join("\t").trim(),
    };
  });
const manualAnswers = fs
  .readFileSync("telegram_archive/manual_answers.tsv", "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [catalogId, postId, answer, source] = line.split("\t");
    return {
      catalogId: Number(catalogId),
      postId: Number(postId),
      answer: answer.trim(),
      source: source.trim(),
    };
  });
const html = fs.readFileSync(
  "outputs/Simple_Quiz_Intelligence_with_Telegram_offline.html",
  "utf8",
);
const rootHtml = fs.readFileSync("Simple_Quiz_Intelligence_v1_offline.html", "utf8");
if (rootHtml !== html) {
  throw new Error("Корневая и выходная HTML-версии различаются");
}
const trainingHtml = fs.readFileSync(
  "outputs/Simple_Quiz_Team_Training.html",
  "utf8",
);
const rootTrainingHtml = fs.readFileSync(
  "Simple_Quiz_Team_Training.html",
  "utf8",
);
if (rootTrainingHtml !== trainingHtml) {
  throw new Error("Корневая и выходная версии HTML-тренажёра различаются");
}
const trainingScriptMatch = trainingHtml.match(/<script>([\s\S]*)<\/script>/);
if (!trainingScriptMatch) {
  throw new Error("В HTML-тренажёре отсутствует встроенный скрипт");
}
new Function(trainingScriptMatch[1]);
const trainingDataMatch = trainingScriptMatch[1].match(
  /const DATA=(\{[\s\S]*?\});\n/,
);
if (!trainingDataMatch) {
  throw new Error("В HTML-тренажёре отсутствуют встроенные данные");
}
const trainingData = JSON.parse(trainingDataMatch[1]);
const trainingExpected = {
  football: 20,
  leagueTeams: 94,
  campaigns: 10,
  nameBridges: 16,
  mythology: 20,
  popCulture: 24,
};
const trainingActual = {
  football: trainingData.football.length,
  leagueTeams: trainingData.leagueCards.length,
  campaigns: trainingData.campaigns.length,
  nameBridges: trainingData.nameBridges.length,
  mythology: trainingData.mythology.length,
  popCulture: trainingData.popCulture.length,
};
for (const [key, value] of Object.entries(trainingExpected)) {
  if (trainingActual[key] !== value) {
    throw new Error(
      `Раздел тренажёра ${key}: HTML=${trainingActual[key]}, ожидалось=${value}`,
    );
  }
}
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
  if (
    !question.mechanic ||
    !question.areas ||
    !question.solutionChain ||
    !Number.isInteger(question.difficulty) ||
    question.difficulty < 1 ||
    question.difficulty > 10 ||
    !["Высокая", "Средняя", "Низкая"].includes(question.repeatability)
  ) {
    throw new Error(`Неполный анализ Telegram-поста ${question.postId}`);
  }
}
const uniqueQuestions = questions.questions.filter(
  (question) => !question.duplicateOfId,
);
if (
  analysisRows.length !== uniqueQuestions.length ||
  new Set(analysisRows.map((row) => row.postId)).size !== analysisRows.length ||
  uniqueQuestions.some(
    (question) => !analysisRows.some((row) => row.postId === question.postId),
  )
) {
  throw new Error("Источник анализа не соответствует новым Telegram-вопросам");
}
for (const verified of verifiedAnswers) {
  const liked = likedByPost.get(verified.postId);
  if (!liked?.likedIds.includes(verified.commentId)) {
    throw new Error(
      `Ответ TG-${verified.postId} ссылается на неподтверждённый комментарий ${verified.commentId}`,
    );
  }
  const question = questions.questions.find(
    (item) => item.postId === verified.postId,
  );
  if (
    question?.answer !== verified.answer ||
    question?.answerSourceCommentId !== verified.commentId
  ) {
    throw new Error(`Ответ TG-${verified.postId} не попал в итоговую базу`);
  }
}
for (const manual of manualAnswers) {
  const question = questions.questions.find(
    (item) => item.postId === manual.postId,
  );
  if (
    question?.catalogId !== manual.catalogId ||
    question?.answer !== manual.answer ||
    question?.answerSourceType !== "user_correction" ||
    question?.answerSourceNote !== manual.source
  ) {
    throw new Error(
      `Пользовательское уточнение для вопроса ${manual.catalogId} не попало в итоговую базу`,
    );
  }
}
if (likedRows.length !== questions.questionCount) {
  throw new Error(
    `Журнал реакций содержит ${likedRows.length} строк вместо ${questions.questionCount}`,
  );
}

const expected = {
  catalog: questions.finalCatalogCount,
  recognized: questions.questionCount,
  added: questions.uniqueAddedToCatalog,
  duplicates: questions.duplicatesSkipped,
  downloaded: mediaFiles.length,
  answered: questions.questions.filter((question) => question.answer).length,
  reactionAnswered: verifiedAnswers.length,
  manualAnswered: manualAnswers.length,
  analyzed: questions.questions.length,
  serviceCards: questions.questions.filter(
    (question) => question.mechanic === "Служебная карточка — не вопрос",
  ).length,
};
if (
  htmlData.sheets["Каталог"].rows.length !== expected.catalog ||
  source.sheets["Каталог"].rows.length + expected.added !== expected.catalog
) {
  throw new Error("Итоговый HTML-каталог не совпадает с исходными данными");
}
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
    `Ответы: ${expected.answered}`,
    `Из них по реакциям: ${verifiedAnswers.length}`,
    `Из них по уточнениям пользователя: ${manualAnswers.length}`,
    `Проанализировано: ${expected.analyzed}`,
    `Служебные карточки: ${expected.serviceCards}`,
    `Средняя сложность: ${htmlData.analysis.averageDifficulty}`,
    `Карточек в тренажёре: ${Object.values(trainingActual).reduce((sum, value) => sum + value, 0)}`,
  ].join("\n"),
);
