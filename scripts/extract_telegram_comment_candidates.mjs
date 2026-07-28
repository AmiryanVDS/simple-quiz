import fs from "node:fs/promises";

const questionsPath = "telegram_archive/questions_enriched.json";
const outputPath = "telegram_archive/comment_candidates.json";
const questionsDocument = JSON.parse(await fs.readFile(questionsPath, "utf8"));
const questions = questionsDocument.questions;
const commentsLimit = 100;
const concurrency = 6;

function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    raquo: "»",
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToText(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function parseReactions(block) {
  const reactionsHtml =
    block.match(
      /<div class="tgme_widget_message_reactions js-message_reactions">([\s\S]*?)<\/div>/,
    )?.[1] ?? "";
  const reactions = [];

  for (const match of reactionsHtml.matchAll(
    /<span class="tgme_reaction">[\s\S]*?<b>([\s\S]*?)<\/b>[\s\S]*?<\/i>\s*(\d+)\s*<\/span>/g,
  )) {
    reactions.push({
      emoji: htmlToText(match[1]),
      count: Number(match[2]),
    });
  }
  return reactions;
}

function parseDiscussion(html, postId) {
  const comments = [];
  const blocks = html
    .split('<div class="tgme_widget_message_wrap js-widget_message_wrap">')
    .slice(1);

  for (const block of blocks) {
    const commentId = Number(block.match(/data-post-id="(\d+)"/)?.[1]);
    if (!commentId) continue;

    const authorHtml =
      block.match(
        /<div class="tgme_widget_message_author[^"]*">([\s\S]*?)<\/div>/,
      )?.[1] ?? "";
    const textHtml =
      block.match(
        /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/,
      )?.[1] ?? "";
    const date = block.match(/<time datetime="([^"]+)"/)?.[1] ?? null;
    const commentUrl =
      decodeEntities(
        block.match(
          /<a class="tgme_widget_message_date" href="([^"]+)"/,
        )?.[1] ?? "",
      ) || `https://t.me/simple_quiz/${postId}?comment=${commentId}`;

    comments.push({
      commentId,
      commentUrl,
      author: htmlToText(authorHtml),
      text: htmlToText(textHtml),
      date,
      reactions: parseReactions(block),
    });
  }

  const declaredCount = Number(
    html.match(/<h3 class="tgme_post_discussion_header">[\s\S]*?(\d+)\s+comments?/i)?.[1] ??
      html.match(/<h3 class="tgme_post_discussion_header">[\s\S]*?(\d+)\s+комментар/i)?.[1] ??
      comments.length,
  );

  const moreClass =
    html.match(/class="([^"]*\btme_messages_more\b[^"]*)"/)?.[1] ?? "";

  return {
    declaredCount,
    comments,
    hasMore: Boolean(moreClass && !/\bhide\b/.test(moreClass)),
  };
}

async function fetchDiscussion(question) {
  const url =
    `https://t.me/simple_quiz/${question.postId}` +
    `?embed=1&discussion=1&comments_limit=${commentsLimit}`;
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return {
      postId: question.postId,
      postUrl: question.postUrl,
      error: `${response.status} ${response.statusText}`,
      commentCount: 0,
      comments: [],
      candidates: [],
    };
  }

  const parsed = parseDiscussion(await response.text(), question.postId);
  return {
    postId: question.postId,
    postUrl: question.postUrl,
    question: question.question,
    commentCount: parsed.declaredCount,
    fetchedCommentCount: parsed.comments.length,
    truncated: parsed.hasMore || parsed.declaredCount > parsed.comments.length,
    comments: parsed.comments,
    candidates: parsed.comments.filter((comment) => comment.reactions.length > 0),
  };
}

const results = new Array(questions.length);
let cursor = 0;
let processed = 0;

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= questions.length) return;

    results[index] = await fetchDiscussion(questions[index]);
    processed += 1;
    if (processed % 20 === 0 || processed === questions.length) {
      console.log(`comments ${processed}/${questions.length}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const withComments = results.filter((item) => item.commentCount > 0);
const withCandidates = results.filter((item) => item.candidates.length > 0);
const summary = {
  extractedAt: new Date().toISOString(),
  sourceChannel: "simple_quiz",
  expectedReactionActor: "«Симпл Квиз» | Минута на обсуждение",
  questionCount: questions.length,
  postsWithComments: withComments.length,
  commentCount: results.reduce((sum, item) => sum + item.comments.length, 0),
  postsWithReactionCandidates: withCandidates.length,
  candidateCount: results.reduce((sum, item) => sum + item.candidates.length, 0),
  truncatedPostIds: results.filter((item) => item.truncated).map((item) => item.postId),
  failedPostIds: results.filter((item) => item.error).map((item) => item.postId),
};

await fs.writeFile(
  outputPath,
  JSON.stringify({ summary, posts: results }, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
