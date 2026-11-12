"""Build game-day reminders from current and legacy weekly polls."""

import html
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


def _event_clock(poll: dict, option_id: int, option_text: str) -> tuple[int, int] | None:
    """Return event HH:MM from stored metadata or a legacy poll option."""
    event = poll.get("events", {}).get(str(option_id))
    raw_time = event.get("time") if isinstance(event, dict) else None
    if raw_time:
        try:
            hour, minute = (int(part) for part in raw_time.split(":", 1))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return hour, minute
        except (TypeError, ValueError):
            pass

    match = OPTION_PATTERN.match(option_text)
    if match:
        try:
            hour, minute = (int(part) for part in match[3].split(":", 1))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return hour, minute
        except (TypeError, ValueError):
            pass
    return None


def build_game_day_reminder(
    state: dict,
    chat_id: int,
    today: date,
    current_time: tuple[int, int] | None = None,
) -> dict | None:
    """Build one reminder only for today's games that have not started yet."""
    games: dict[str, int] = {}
    for poll in state.get("polls", {}).values():
        if poll.get("chat_id") != chat_id:
            continue
        message_id = poll.get("message_id") or 0
        for option_id, option_text, event_date in poll_events(poll):
            if event_date != today:
                continue

            event_clock = _event_clock(poll, option_id, option_text)
            if current_time is not None and event_clock is not None and event_clock <= current_time:
                continue

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
        "Проверьте свой ответ в недельном опросе до начала квиза: "
        "выберите игру или вариант «Не иду». Иначе зачем это все?)",
    ])
    return {
        "text": "\n".join(lines),
        "poll_message_id": next((message_id for message_id in games.values() if message_id), 0),
    }
