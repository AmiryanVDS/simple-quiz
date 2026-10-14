import json
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pdmb_bot"))
from poll_summary import build_game_day_summaries
from team_members import normalized_name, remember_team_user, resolve_team_members


CHAT = -100123
TODAY = date(2026, 9, 30)
TEAM = [{"name": "Иван", "user_id": 1}, {"name": "Пётр", "user_id": 2}, {"name": "Анна", "user_id": 3}]
ROSTER = json.loads((Path(__file__).resolve().parents[1] / "pdmb_bot" / "team_roster.json").read_text())


def state_with_answers(answers):
    return {"polls": {"p": {
        "chat_id": CHAT,
        "message_id": 123,
        "week_start": "2026-09-28",
        "week_end": "2026-10-05",
        "options": ["30.09 (СР) 20:00 — Спорт", "❌ Не иду"],
        "answers": answers,
    }}}


def profile(name, options):
    return {"name": name, "option_ids": options, "updated_at": "2026-09-30T12:00:00+03:00"}


class NonvoterTests(unittest.TestCase):
    def test_three_groups_with_id_mention_and_poll_reply(self):
        state = state_with_answers({"1": profile("Иван", [0]), "2": profile("Пётр", [1])})
        summary = build_game_day_summaries(state, CHAT, TODAY, team=TEAM)[0]
        self.assertIn("Идут — 1", summary["text"])
        self.assertIn("Не идут — 1", summary["text"])
        self.assertIn("Не проголосовали — 1", summary["text"])
        self.assertIn('<a href="tg://user?id=3">Анна</a>', summary["text"])
        self.assertNotIn('tg://user?id=1', summary["text"])
        self.assertNotIn('tg://user?id=2', summary["text"])
        self.assertIn("Пожалуйста, ответьте в опросе", summary["text"])
        self.assertEqual(summary["poll_message_id"], 123)

    def test_retracted_vote_is_unanswered_not_refusal(self):
        state = state_with_answers({"1": profile("Иван", []), "2": profile("Пётр", [1]), "3": profile("Анна", [0])})
        text = build_game_day_summaries(state, CHAT, TODAY, team=TEAM)[0]["text"]
        self.assertIn("Не идут — 1", text)
        self.assertIn('<a href="tg://user?id=1">Иван</a>', text)
        self.assertIn("Не проголосовали — 1", text)

    def test_all_answered_no_reminder(self):
        state = state_with_answers({str(i): profile(str(i), [1]) for i in (1, 2, 3)})
        text = build_game_day_summaries(state, CHAT, TODAY, team=TEAM)[0]["text"]
        self.assertIn("Не проголосовали — 0", text)
        self.assertIn("Все участники команды ответили", text)
        self.assertNotIn("Пожалуйста", text)

    def test_unknown_id_uses_plain_escaped_name(self):
        text = build_game_day_summaries(state_with_answers({}), CHAT, TODAY, team=[{"name": "<Анна>"}])[0]["text"]
        self.assertIn("Не проголосовали — 1", text)
        self.assertIn("&lt;Анна&gt;", text)
        self.assertNotIn("tg://user", text)

    def test_votes_from_other_polls_do_not_count_as_current_response(self):
        state = state_with_answers({})
        state["polls"]["old"] = {
            "chat_id": CHAT, "week_start": "2026-09-21", "week_end": "2026-09-28",
            "options": ["23.09 (СР) 20:00 — Спорт"], "answers": {"1": profile("Иван", [0])},
        }
        text = build_game_day_summaries(state, CHAT, TODAY, team=TEAM)[0]["text"]
        self.assertIn("Не проголосовали — 3", text)


class MemberBindingTests(unittest.TestCase):
    def test_actual_poll_names_map_to_seven_roster_members_without_overlap(self):
        names = [
            "Armen Khachatryan (@armen_test)",
            "Kostya",
            "Maxim Derbenev (@maxim_test)",
            "Ruslan",
            "david (@david_test)",
            "Василий Амирян (@vasily_test)",
            "Тимур",
        ]
        state = state_with_answers({
            str(index): profile(name, [1]) for index, name in enumerate(names, start=1)
        })
        team = resolve_team_members(state, CHAT, ROSTER)
        self.assertEqual(sum(bool(member.get("user_id")) for member in team), 7)
        summary = build_game_day_summaries(state, CHAT, TODAY, team=team)[0]["text"]
        self.assertIn("Не идут — 7", summary)
        self.assertIn("Не проголосовали — 1", summary)
        self.assertIn("Али Алекперов", summary)
        self.assertNotIn("@david_test", summary)
        self.assertNotIn("Kostya", summary)
        for member in team:
            if member["name"] != "Али Алекперов":
                self.assertEqual(summary.count(member["name"]), 1)

    def test_username_beats_conflicting_display_name(self):
        state = state_with_answers({"7": {
            **profile("Kostya (@david_test)", [1]),
            "full_name": "Kostya", "username": "david_test",
        }})
        roster = [{"name": "Давид Маргиев", "usernames": ["david_test"]},
                  {"name": "Костя", "aliases": ["Kostya"]}]
        team = resolve_team_members(state, CHAT, roster)
        by_name = {member["name"]: member.get("user_id") for member in team}
        self.assertEqual(by_name["Давид Маргиев"], 7)
        self.assertIsNone(by_name["Костя"])

    def test_ambiguous_alias_does_not_guess_id(self):
        state = state_with_answers({"7": profile("Ruslan", [1]), "8": profile("Ruslan", [1])})
        team = resolve_team_members(state, CHAT, ROSTER)
        ruslan = next(member for member in team if member["name"] == "Руслан Исмаилов")
        self.assertNotIn("user_id", ruslan)

    def test_new_message_with_alias_or_username_saves_canonical_name(self):
        state = {"polls": {}}
        user = SimpleNamespace(id=7, is_bot=False, full_name="Kostya", username=None)
        self.assertTrue(remember_team_user(state, CHAT, user, ROSTER, "2026-10-14T12:00:00+03:00"))
        self.assertEqual(state["team_users"][str(CHAT)]["7"]["roster_name"], "Костя")
        user = SimpleNamespace(id=8, is_bot=False, full_name="david", username="david_test")
        self.assertTrue(remember_team_user(state, CHAT, user, ROSTER, "2026-10-14T12:00:00+03:00"))
        self.assertEqual(state["team_users"][str(CHAT)]["8"]["roster_name"], "Давид Маргиев")

    def test_exact_legacy_names_ignore_emojis_username_and_yo(self):
        self.assertEqual(normalized_name("Пётр Петров ⚽ (@petr)"), "петр петров")
        state = state_with_answers({"7": profile("Пётр Петров ⚽ (@petr)", [0])})
        team = resolve_team_members(state, CHAT, [{"name": "Петр Петров"}])
        self.assertEqual(team[0]["user_id"], 7)

    def test_other_chat_and_approximate_names_are_not_bound(self):
        state = state_with_answers({"7": profile("Иван Петров", [0])})
        state["polls"]["p"]["chat_id"] = 42
        self.assertNotIn("user_id", resolve_team_members(state, CHAT, [{"name": "Иван Петров"}])[0])
        state["polls"]["p"]["chat_id"] = CHAT
        self.assertNotIn("user_id", resolve_team_members(state, CHAT, [{"name": "Иван"}])[0])

    def test_namesakes_are_not_guessed(self):
        state = state_with_answers({"7": profile("Костя", [0]), "8": profile("Костя", [1])})
        self.assertNotIn("user_id", resolve_team_members(state, CHAT, [{"name": "Костя"}])[0])

    def test_explicit_id_overrides_name_change(self):
        state = state_with_answers({"7": profile("Другое имя", [0])})
        self.assertEqual(resolve_team_members(state, CHAT, [{"name": "Иван", "user_id": 7}])[0]["user_id"], 7)

    def test_message_learns_id_and_preserves_binding_after_rename(self):
        state = {"polls": {}}
        roster = [{"name": "Иван Петров"}]
        user = SimpleNamespace(id=7, is_bot=False, full_name="Иван Петров ⚽", username="ivan")
        self.assertTrue(remember_team_user(state, CHAT, user, roster, "2026-09-30T12:00:00+03:00"))
        self.assertEqual(resolve_team_members(state, CHAT, roster)[0]["user_id"], 7)
        user.full_name = "Новое имя"
        self.assertTrue(remember_team_user(state, CHAT, user, roster, "2026-09-30T13:00:00+03:00"))
        self.assertEqual(resolve_team_members(state, CHAT, roster)[0]["user_id"], 7)

    def test_bot_and_unlisted_users_are_ignored(self):
        state = {}
        user = SimpleNamespace(id=7, is_bot=True, full_name="Иван", username=None)
        self.assertFalse(remember_team_user(state, CHAT, user, [{"name": "Иван"}], "now"))
        user.is_bot = False
        self.assertFalse(remember_team_user(state, CHAT, user, [{"name": "Анна"}], "now"))
        self.assertEqual(state, {})


if __name__ == "__main__":
    unittest.main()
