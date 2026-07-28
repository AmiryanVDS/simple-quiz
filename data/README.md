# Данные проекта

## `source/`

`Simple_Quiz_Intelligence_base.xlsx` — неизменяемая исходная база из 48
вопросов. Скрипт `scripts/update_workbook_with_telegram.mjs` всегда начинает
сборку с этого файла, поэтому повторный запуск не создаёт дубликаты.

## Производные данные

Производные данные Telegram остаются в `telegram_archive/`:

- `manifest.json`;
- `questions.json`;
- `questions_enriched.json`;
- `questions.csv`.

Медиа и сырые страницы не входят в Git и воспроизводятся скриптом архивации.
