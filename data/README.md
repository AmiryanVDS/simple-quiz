# Данные проекта

## `source/`

`Simple_Quiz_Intelligence_base.json` — исходная база из 48 вопросов и
справочные таблицы. Скрипт `scripts/enrich_telegram_questions.mjs` всегда
начинает сборку с этого файла, поэтому повторный запуск не создаёт дубликаты.

## Производные данные

Производные данные Telegram остаются в `telegram_archive/`:

- `manifest.json`;
- `questions.json`;
- `questions_enriched.json`;
- `questions.csv`.

Медиа и сырые страницы не входят в Git и воспроизводятся скриптом архивации.
