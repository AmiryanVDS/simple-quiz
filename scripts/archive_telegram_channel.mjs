import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const projectDir = process.cwd();
const archiveDir = path.join(projectDir, "telegram_archive");
const pagesDir = path.join(archiveDir, "pages");
const mediaDir = path.join(archiveDir, "media");
const manifestPath = path.join(archiveDir, "manifest.json");
const channel = "simple_quiz";
const baseUrl = `https://t.me/s/${channel}`;
const downloadMedia = process.argv.includes("--download");

await fs.mkdir(pagesDir, { recursive: true });
await fs.mkdir(mediaDir, { recursive: true });

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToText(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function absoluteUrl(value) {
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://t.me${value}`;
  return value;
}

function collectMatches(text, regex) {
  const values = [];
  for (const match of text.matchAll(regex)) values.push(absoluteUrl(decodeEntities(match[1])));
  return [...new Set(values)];
}

function parsePosts(html) {
  const blocks = html.split('<div class="tgme_widget_message_wrap js-widget_message_wrap">').slice(1);
  const posts = [];

  for (const block of blocks) {
    const idMatch = block.match(/data-post="simple_quiz\/(\d+)"/);
    if (!idMatch) continue;
    const postId = Number(idMatch[1]);
    const date = block.match(/<time datetime="([^"]+)"/)?.[1] ?? null;
    const textHtml =
      block.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
      "";
    const photos = collectMatches(
      block,
      /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g,
    );
    const videos = [
      ...collectMatches(block, /<video[^>]+src="([^"]+)"/g),
      ...collectMatches(block, /<source[^>]+src="([^"]+)"/g),
    ];
    posts.push({
      id: postId,
      url: `https://t.me/${channel}/${postId}`,
      date,
      text: htmlToText(textHtml),
      photos: [...new Set(photos)],
      videos: [...new Set(videos)],
    });
  }
  return posts;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

const postsById = new Map();
let pageUrl = baseUrl;
let pageNumber = 0;
const visited = new Set();

while (pageUrl && !visited.has(pageUrl) && pageNumber < 100) {
  visited.add(pageUrl);
  pageNumber += 1;
  const html = await fetchText(pageUrl);
  await fs.writeFile(path.join(pagesDir, `${String(pageNumber).padStart(3, "0")}.html`), html);
  const posts = parsePosts(html);
  for (const post of posts) postsById.set(post.id, post);
  const before = html.match(/<link rel="prev" href="\/s\/simple_quiz\?before=(\d+)"/)?.[1];
  console.log(
    `page ${pageNumber}: ${posts.length} posts, ${postsById.size} unique, next before=${before ?? "none"}`,
  );
  pageUrl = before ? `${baseUrl}?before=${before}` : null;
}

const posts = [...postsById.values()].sort((a, b) => a.id - b.id);
const media = [];
for (const post of posts) {
  post.photos.forEach((url, index) =>
    media.push({ postId: post.id, postUrl: post.url, kind: "photo", index: index + 1, url }),
  );
  post.videos.forEach((url, index) =>
    media.push({ postId: post.id, postUrl: post.url, kind: "video", index: index + 1, url }),
  );
}

const manifest = {
  channel,
  source: baseUrl,
  archivedAt: new Date().toISOString(),
  pageCount: pageNumber,
  postCount: posts.length,
  mediaCount: media.length,
  photoCount: media.filter((item) => item.kind === "photo").length,
  videoCount: media.filter((item) => item.kind === "video").length,
  posts,
  media,
};

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(
  `manifest: ${manifest.postCount} posts, ${manifest.photoCount} photos, ${manifest.videoCount} videos`,
);

if (!downloadMedia) process.exit(0);

function extensionFor(contentType, kind) {
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("mp4")) return ".mp4";
  if (contentType.includes("webm")) return ".webm";
  return kind === "video" ? ".mp4" : ".jpg";
}

async function downloadOne(item) {
  const prefix = `post_${String(item.postId).padStart(4, "0")}_${item.kind}_${String(item.index).padStart(2, "0")}`;
  const existing = (await fs.readdir(mediaDir)).find((name) => name.startsWith(`${prefix}.`));
  if (existing) return { ...item, file: path.join("media", existing), skipped: true };

  const response = await fetch(item.url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
    },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText}: ${item.url}`);
  }
  const extension = extensionFor(response.headers.get("content-type") ?? "", item.kind);
  const fileName = `${prefix}${extension}`;
  const filePath = path.join(mediaDir, fileName);
  await pipeline(Readable.fromWeb(response.body), (await import("node:fs")).createWriteStream(filePath));
  return {
    ...item,
    file: path.join("media", fileName),
    contentType: response.headers.get("content-type"),
    bytes: Number(response.headers.get("content-length") ?? 0) || null,
  };
}

const completed = [];
const failures = [];
let cursor = 0;
let processed = 0;
const concurrency = 6;

async function worker() {
  while (true) {
    const itemIndex = cursor;
    cursor += 1;
    if (itemIndex >= media.length) return;
    const item = media[itemIndex];
    try {
      completed[itemIndex] = await downloadOne(item);
    } catch (error) {
      failures.push({ ...item, error: error.message });
    }
    processed += 1;
    if (processed % 20 === 0 || processed === media.length) {
      console.log(`downloaded ${processed}/${media.length}; failures ${failures.length}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
manifest.media = completed.filter(Boolean);
manifest.failures = failures;
manifest.downloadedAt = new Date().toISOString();
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`done: ${manifest.media.length} media files; ${failures.length} failures`);
