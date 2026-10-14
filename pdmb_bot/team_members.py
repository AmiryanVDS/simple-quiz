"""Resolve the configured team against Telegram IDs already known in this chat."""

import re
import unicodedata


def normalized_name(value: str) -> str:
    value = re.sub(r"\s*\(@[^)]+\)\s*$", "", value)
    value = unicodedata.normalize("NFKC", value).casefold().replace("ё", "е")
    return " ".join(re.findall(r"\w+", value))


def normalized_username(value: str | None) -> str:
    return (value or "").lstrip("@").casefold()


def member_names(member: dict) -> set[str]:
    return {normalized_name(name) for name in [member["name"], *member.get("aliases", [])]}


def profile_username(profile: dict) -> str:
    username = profile.get("username")
    if not username:
        match = re.search(r"\(@([^\s)]+)\)\s*$", profile.get("name", ""))
        username = match.group(1) if match else ""
    return normalized_username(username)


def profile_names(profile: dict) -> set[str]:
    if profile.get("roster_name"):
        return {normalized_name(profile["roster_name"])}
    return {
        normalized_name(name)
        for observation in [profile, *profile.get("_observations", [])]
        for name in (observation.get("full_name"), observation.get("name"))
        if name
    }


def profile_usernames(profile: dict) -> set[str]:
    return {
        username for observation in [profile, *profile.get("_observations", [])]
        if (username := profile_username(observation))
    }


def matching_ids(member: dict, profiles: dict, by_username: bool) -> list[str]:
    if by_username:
        usernames = {normalized_username(value) for value in member.get("usernames", [])}
        usernames.discard("")
        return [user_id for user_id, profile in profiles.items()
                if usernames & profile_usernames(profile)] if usernames else []
    names = member_names(member)
    return [user_id for user_id, profile in profiles.items()
            if names & profile_names(profile)]


def resolve_team_members(state: dict, chat_id: int, roster: list[dict]) -> list[dict]:
    profiles = {
        user_id: {**profile, "_observations": []}
        for user_id, profile in state.get("team_users", {}).get(str(chat_id), {}).items()
    }
    for poll in state.get("polls", {}).values():
        if poll.get("chat_id") != chat_id:
            continue
        for user_id, answer in poll.get("answers", {}).items():
            previous = profiles.get(user_id, {})
            observations = [*previous.get("_observations", []), answer]
            if answer.get("updated_at", "") >= previous.get("updated_at", ""):
                profiles[user_id] = {**previous, **answer, "_observations": observations}
            else:
                previous["_observations"] = observations

    members = [dict(member) for member in roster]
    used_ids = {int(member["user_id"]) for member in members if member.get("user_id")}
    # A unique username is stronger evidence than a display name. Never assign
    # one Telegram ID to two roster entries or guess between namesakes.
    for by_username in (True, False):
        proposals: dict[int, list[int]] = {}
        for index, member in enumerate(members):
            if member.get("user_id"):
                continue
            candidates = matching_ids(member, profiles, by_username)
            if len(candidates) == 1 and int(candidates[0]) not in used_ids:
                proposals.setdefault(int(candidates[0]), []).append(index)
        for user_id, indices in proposals.items():
            if len(indices) == 1:
                members[indices[0]]["user_id"] = user_id
                used_ids.add(user_id)
    return members


def remember_team_user(state: dict, chat_id: int, user, roster: list[dict], updated_at: str) -> bool:
    if user.is_bot:
        return False
    known = state.get("team_users", {}).get(str(chat_id), {})
    matches = [member for member in roster if member.get("user_id") == user.id]
    if not matches:
        matches = [member for member in roster
                   if normalized_username(user.username) in {
                       normalized_username(value) for value in member.get("usernames", [])
                   } and user.username]
    if not matches:
        matches = [member for member in roster
                   if normalized_name(user.full_name) in member_names(member)]
    if str(user.id) not in known and len(matches) != 1:
        return False
    state.setdefault("team_users", {}).setdefault(str(chat_id), {})[str(user.id)] = {
        "roster_name": known.get(str(user.id), {}).get("roster_name") or (
            matches[0]["name"] if len(matches) == 1 else user.full_name
        ),
        "full_name": user.full_name,
        "username": user.username,
        "updated_at": updated_at,
    }
    return True
