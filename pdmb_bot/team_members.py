"""Resolve the configured team against Telegram IDs already known in this chat."""

import re
import unicodedata


def normalized_name(value: str) -> str:
    value = re.sub(r"\s*\(@[^)]+\)\s*$", "", value)
    value = unicodedata.normalize("NFKC", value).casefold().replace("ё", "е")
    return " ".join(re.findall(r"\w+", value))


def resolve_team_members(state: dict, chat_id: int, roster: list[dict]) -> list[dict]:
    profiles = dict(state.get("team_users", {}).get(str(chat_id), {}))
    for poll in state.get("polls", {}).values():
        if poll.get("chat_id") != chat_id:
            continue
        for user_id, answer in poll.get("answers", {}).items():
            previous = profiles.get(user_id, {})
            if answer.get("updated_at", "") >= previous.get("updated_at", ""):
                profiles[user_id] = {**previous, **answer}

    members = []
    for configured in roster:
        member = dict(configured)
        user_id = member.get("user_id")
        if not user_id:
            candidates = [
                key for key, profile in profiles.items()
                if normalized_name(profile.get("roster_name") or profile.get("full_name") or profile.get("name", ""))
                == normalized_name(member["name"])
            ]
            # Do not bind a namesake or an approximate name to someone else's ID.
            if len(candidates) == 1:
                user_id = int(candidates[0])
        if user_id:
            member["user_id"] = int(user_id)
        members.append(member)
    return members


def remember_team_user(state: dict, chat_id: int, user, roster: list[dict], updated_at: str) -> bool:
    if user.is_bot:
        return False
    configured_names = {normalized_name(member["name"]) for member in roster}
    configured_ids = {member.get("user_id") for member in roster if member.get("user_id")}
    known = state.get("team_users", {}).get(str(chat_id), {})
    if (
        normalized_name(user.full_name) not in configured_names
        and user.id not in configured_ids
        and str(user.id) not in known
    ):
        return False
    state.setdefault("team_users", {}).setdefault(str(chat_id), {})[str(user.id)] = {
        "roster_name": known.get(str(user.id), {}).get("roster_name") or next(
            (member["name"] for member in roster
             if normalized_name(member["name"]) == normalized_name(user.full_name)
             or member.get("user_id") == user.id),
            user.full_name,
        ),
        "full_name": user.full_name,
        "username": user.username,
        "updated_at": updated_at,
    }
    return True
