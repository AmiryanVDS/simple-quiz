"""Attendance summaries for games taking place today, including legacy polls."""

import hashlib
import html
import json
import re
from datetime import date


OPTION_PATTERN = re.compile(
    r"^(\d{1,2})\.(\d{1,2})(?:\s*\([^)]*\))?\s+"
    r"(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$"
)


def poll_events(poll: dict):
    """Use stored dates, or recover dates from options in already published polls."""
    for option_id, option_text in enumerate(poll.get("options", [])):
        event = poll.get("events", {}).get(str(option_id))
        if event:
            try:
                event_date = date.fromisoformat(event["event_date"])
            except (KeyError, TypeError, ValueError):
                continue
        else:
            match = OPTION_PATTERN.match(option_text)
            if not match:
                continue
            try:
                week_start = date.fromisoformat(poll["week_start"])
                week_end = date.fromisoformat(poll["week_end"])
                event_date = next(
                    candidate
                    for year in range(week_start.year, week_end.year + 1)
                    if (candidate := date(year, int(match[2]), int(match[1])))
                    and week_start <= candidate <= week_end
                )
            except (KeyError, TypeError, ValueError, StopIteration):
                continue

        yield option_id, option_text, event_date


def build_game_day_reminder(state: dict, chat_id: int, today: date) -> dict | None:
    """Build one reminder for all today's games already present in weekly polls."""
    games: dict[str, int] = {}
    for poll in state.get("polls", {}).values():
        if poll.get("chat_id") != chat_id:
            continue
        message_id = poll.get("message_id") or 0
        for _, option_text, event_date in poll_events(poll):
            if event_date == today:
                games[option_text] = max(games.get(option_text, 0), message_id)

    if not games:
        return None

    private_chat_id = str(chat_id)[4:] if str(chat_id).startswith("-100") else None
    lines = ["🔔 <b>Сегодня квизы</b>" if len(games) > 1 else "🔔 <b>Сегодня квиз</b>", ""]
    for option_text, message_id in sorted(games.items()):
        title = html.escape(option_text)
        if private_chat_id and message_id:
            title = f'<a href="https://t.me/c/{private_chat_id}/{message_id}">{title}</a>'
        lines.append(f"• {title}")
    lines.extend([
        "",
        "Проверьте свой ответ в недельном опросе до 17:00 МСК, "
        "чтобы ваш выбор попал в итог.",
    ])
    return {
        "text": "\n".join(lines),
        "poll_message_id": next((message_id for message_id in games.values() if message_id), 0),
    }


def build_game_day_summaries(
    state: dict,
    chat_id: int,
    today: date,
    team: list[dict] | None = None,
) -> list[dict]:
    """Merge copies of a game and use each Telegram user's latest response."""
    games = {}
    for poll in state.get("polls", {}).values():
        if poll.get("chat_id") != chat_id:
            continue
        for option_id, option_text, event_date in poll_events(poll):
            if event_date != today:
                continue
            # The option text also identifies legacy games without stored metadata.
            identity = json.dumps([chat_id, event_date.isoformat(), option_text], ensure_ascii=False)
            key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            game = games.setdefault(key, {"option_text": option_text, "answers": {}, "message_id": 0})
            game["message_id"] = max(game["message_id"], poll.get("message_id", 0))
            for user_id, answer in poll.get("answers", {}).items():
                previous = game["answers"].get(user_id)
                if previous and previous["updated_at"] > answer.get("updated_at", ""):
                    continue
                selected = answer.get("option_ids", [])
                game["answers"][user_id] = {
                    "name": answer.get("name", "Участник"),
                    "going": option_id in selected,
                    "answered": bool(selected),
                    "updated_at": answer.get("updated_at", ""),
                }

    result = []
    for key, game in sorted(games.items(), key=lambda item: item[1]["option_text"]):
        going = sorted(
            answer["name"] for answer in game["answers"].values()
            if answer["answered"] and answer["going"]
        )
        not_going = sorted(
            answer["name"] for answer in game["answers"].values()
            if answer["answered"] and not answer["going"]
        )
        lines = [
            "📊 <b>Кто идёт на сегодняшний квиз</b>",
            f"<b>{html.escape(game['option_text'])}</b>",
            "",
            f"✅ <b>Идут — {len(going)}</b>",
            ", ".join(html.escape(name) for name in going) or "Пока никто не подтвердил участие.",
            "",
            f"❌ <b>Не идут — {len(not_going)}</b>",
            ", ".join(html.escape(name) for name in not_going) or "Пока нет таких ответов.",
        ]
        if team is not None:
            unanswered = [
                member for member in team
                if not game["answers"].get(str(member.get("user_id")), {}).get("answered")
            ]
            mentions = [
                f'<a href="tg://user?id={int(member["user_id"])}">{html.escape(member["name"])}</a>'
                if member.get("user_id") else html.escape(member["name"])
                for member in unanswered
            ]
            lines.extend([
                "",
                f"⏳ <b>Не проголосовали — {len(unanswered)}</b>",
                ", ".join(mentions) or "Все участники команды ответили.",
            ])
            if unanswered:
                lines.extend(["", "Пожалуйста, ответьте в опросе: выберите игры или вариант «Не иду»."])
        else:
            lines.extend([
                "",
                "Учитываются ответы в опросе. Те, кто не ответил или отменил голос, "
                "не считаются отказавшимися.",
            ])
        result.append({
            "key": key,
            "event_date": today.isoformat(),
            "text": "\n".join(lines),
            "poll_message_id": game["message_id"],
        })
    return result
