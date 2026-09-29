import copy
import os
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pdmb_bot"))
from poll_summary import build_game_day_summaries

IMPORT_STATE = tempfile.TemporaryDirectory()
with patch.dict(os.environ, {
    "BOT_TOKEN": "123456:TEST_TOKEN_FOR_LOCAL_TESTS",
    "CHAT_ID": "-100123",
    "TRAINING_URL": "https://example.com/training",
    "PDMB_STATE_DIR": IMPORT_STATE.name,
}):
    import bot as bot_module


CHAT = -100123
TODAY = date(2026, 9, 30)
MOSCOW = ZoneInfo("Europe/Moscow")


def poll(options=None, answers=None, **extra):
    return {
        "chat_id": CHAT,
        "week_start": "2026-09-28",
        "week_end": "2026-10-05",
        "options": options or [
            "30.09 (СР) 20:00 — Спорт",
            "02.10 (ПТ) 20:00 — Футбол",
            "❌ Не иду никуда",
        ],
        "answers": answers or {},
        **extra,
    }


def answer(name, options, updated="2026-09-29T12:00:00+03:00"):
    return {"name": name, "option_ids": options, "updated_at": updated}


class SummaryTests(unittest.TestCase):
    def test_today_only_and_going_not_going(self):
        state = {"polls": {"p": poll(answers={
            "1": answer("Идёт", [0, 1]),
            "2": answer("Другая игра", [1]),
            "3": answer("Отказ", [2]),
            "4": answer("Отменил", []),
        })}}
        summaries = build_game_day_summaries(state, CHAT, TODAY)
        self.assertEqual(len(summaries), 1)
        text = summaries[0]["text"]
        self.assertIn("Идут — 1", text)
        self.assertIn("Не идут — 2", text)
        self.assertIn("Другая игра, Отказ", text)
        self.assertNotIn("Отменил", text)
        self.assertNotIn("Футбол", text)

    def test_same_names_count_by_telegram_id_and_escape_html(self):
        p = poll(answers={"1": answer("<Иван>", [0]), "2": answer("<Иван>", [0])})
        text = build_game_day_summaries({"polls": {"p": p}}, CHAT, TODAY)[0]["text"]
        self.assertIn("Идут — 2", text)
        self.assertIn("&lt;Иван&gt;, &lt;Иван&gt;", text)

    def test_metadata_date_is_authoritative(self):
        p = poll(events={"0": {"event_date": "2026-10-01"}})
        self.assertEqual(build_game_day_summaries({"polls": {"p": p}}, CHAT, TODAY), [])
        self.assertEqual(len(build_game_day_summaries({"polls": {"p": p}}, CHAT, date(2026, 10, 1))), 1)

    def test_legacy_dates_cross_year_and_invalid_options(self):
        p = poll(
            options=["01.01 (ПТ) 19:00 — Новый год", "31.02 (СР) 20:00 — Ошибка", "Свой вариант"],
            week_start="2026-12-28", week_end="2027-01-04",
        )
        summaries = build_game_day_summaries({"polls": {"p": p}}, CHAT, date(2027, 1, 1))
        self.assertEqual(len(summaries), 1)
        self.assertIn("Новый год", summaries[0]["text"])

    def test_multiple_games_and_chat_isolation(self):
        p = poll(options=["30.09 (СР) 19:00 — Один", "30.09 (СР) 21:00 — Два", "❌ Не иду"])
        other = poll(chat_id=42)
        summaries = build_game_day_summaries({"polls": {"p": p, "other": other}}, CHAT, TODAY)
        self.assertEqual(len(summaries), 2)

    def test_duplicate_polls_use_latest_vote_even_when_revoked(self):
        older = poll(answers={"1": answer("Первый", [0]), "2": answer("Второй", [0])})
        newer = poll(answers={
            "1": answer("Первый", [2], "2026-09-30T11:00:00+03:00"),
            "2": answer("Второй", [], "2026-09-30T11:00:00+03:00"),
        })
        # Deliberately put the newer poll first: insertion order must not decide.
        summaries = build_game_day_summaries({"polls": {"new": newer, "old": older}}, CHAT, TODAY)
        self.assertEqual(len(summaries), 1)
        self.assertIn("Идут — 0", summaries[0]["text"])
        self.assertIn("Не идут — 1", summaries[0]["text"])
        self.assertNotIn("Второй", summaries[0]["text"])

    def test_overlapping_mondays_keep_same_game_identity(self):
        text = "05.10 (ПН) 20:00 — Спорт"
        previous = poll(options=[text, "❌ Не иду"], answers={"1": answer("Иван", [0])})
        current = poll(options=[text, "❌ Не иду"], week_start="2026-10-05", week_end="2026-10-12")
        state = {"polls": {"old": previous, "new": current}}
        summaries = build_game_day_summaries(state, CHAT, date(2026, 10, 5))
        self.assertEqual(len(summaries), 1)
        old_key = build_game_day_summaries({"polls": {"p": previous}}, CHAT, date(2026, 10, 5))[0]["key"]
        self.assertEqual(summaries[0]["key"], old_key)
        self.assertIn("Идут — 1", summaries[0]["text"])

    def test_unanswered_game_still_has_both_lists(self):
        text = build_game_day_summaries({"polls": {"p": poll()}}, CHAT, TODAY)[0]["text"]
        self.assertIn("Идут — 0", text)
        self.assertIn("Не идут — 0", text)


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        state_path = str(Path(self.temp.name) / "weekly_poll_state.json")
        self.state_patch = patch.object(bot_module, "POLL_STATE_FILE", state_path)
        self.state_patch.start()
        self.addCleanup(self.state_patch.stop)
        self.sender = AsyncMock(return_value=SimpleNamespace(message_id=77))
        self.bot_patch = patch.object(bot_module, "bot", SimpleNamespace(send_message=self.sender))
        self.bot_patch.start()
        self.addCleanup(self.bot_patch.stop)
        bot_module.save_poll_state({"polls": {"p": poll()}, "last_summary_date": "2026-09-30"})

    async def test_1700_and_late_restart_send_once_with_legacy_state(self):
        self.assertEqual(await bot_module.send_game_day_summaries(now=datetime(2026, 9, 30, 16, 59, tzinfo=MOSCOW)), 0)
        self.sender.assert_not_awaited()
        self.assertEqual(await bot_module.send_game_day_summaries(now=datetime(2026, 9, 30, 17, 0, tzinfo=MOSCOW)), 1)
        self.assertEqual(await bot_module.send_game_day_summaries(now=datetime(2026, 9, 30, 19, 0, tzinfo=MOSCOW)), 0)
        self.assertEqual(self.sender.await_count, 1)
        record = next(iter(bot_module.load_poll_state()["sent_game_summaries"].values()))
        self.assertEqual(record["event_date"], "2026-09-30")
        self.assertEqual(record["message_id"], 77)

    async def test_no_game_does_not_mark_day_done(self):
        bot_module.save_poll_state({"polls": {}})
        now = datetime(2026, 9, 30, 18, 0, tzinfo=MOSCOW)
        self.assertEqual(await bot_module.send_game_day_summaries(now=now), 0)
        self.assertNotIn("sent_game_summaries", bot_module.load_poll_state())
        bot_module.save_poll_state({"polls": {"p": poll()}})
        self.assertEqual(await bot_module.send_game_day_summaries(now=now), 1)

    async def test_next_day_does_not_send_yesterdays_game(self):
        self.assertEqual(await bot_module.send_game_day_summaries(now=datetime(2026, 10, 1, 18, 0, tzinfo=MOSCOW)), 0)
        self.sender.assert_not_awaited()

    async def test_failure_retries_only_unsent_game(self):
        p = poll(options=["30.09 (СР) 19:00 — Один", "30.09 (СР) 21:00 — Два"])
        bot_module.save_poll_state({"polls": {"p": p}})
        self.sender.side_effect = [RuntimeError("Telegram temporarily unavailable"), SimpleNamespace(message_id=78)]
        now = datetime(2026, 9, 30, 17, 0, tzinfo=MOSCOW)
        with self.assertLogs(level="ERROR"):
            self.assertEqual(await bot_module.send_game_day_summaries(now=now), 1)
        self.sender.side_effect = None
        self.assertEqual(await bot_module.send_game_day_summaries(now=now), 1)
        self.assertEqual(len(bot_module.load_poll_state()["sent_game_summaries"]), 2)
        self.assertEqual(self.sender.await_count, 3)

    async def test_answers_arriving_during_send_are_preserved(self):
        async def sending(**kwargs):
            state = bot_module.load_poll_state()
            state["polls"]["p"]["answers"]["5"] = answer("Поздний", [0])
            bot_module.save_poll_state(state)
            return SimpleNamespace(message_id=77)
        self.sender.side_effect = sending
        await bot_module.send_game_day_summaries(now=datetime(2026, 9, 30, 17, 0, tzinfo=MOSCOW))
        self.assertIn("5", bot_module.load_poll_state()["polls"]["p"]["answers"])

    async def test_monday_only_reports_mondays_games_and_keeps_package(self):
        bot_module.save_poll_state({"polls": {"p": poll()}, "last_schedule_date": None, "last_poll_date": None})
        with patch.object(bot_module, "send_weekly_package", new_callable=AsyncMock) as package:
            await bot_module.run_scheduled_tasks(datetime(2026, 10, 5, 17, 0, tzinfo=MOSCOW))
            package.assert_awaited_once()
        self.sender.assert_not_awaited()

    async def test_poll_answers_replace_and_revoke_previous_vote(self):
        user = bot_module.types.User(id=1, is_bot=False, first_name="Иван")
        for options in ([0], [1], []):
            await bot_module.handle_poll_answer(bot_module.types.PollAnswer(
                poll_id="p", user=user, option_ids=options,
                option_persistent_ids=[f"option-{index}" for index in options],
            ))
            stored = bot_module.load_poll_state()["polls"]["p"]["answers"]["1"]
            self.assertEqual(stored["option_ids"], options)
        self.sender.assert_not_awaited()

    async def test_team_reminder_replies_to_poll_and_mentions_only_nonvoter(self):
        roster = [{"name": "Иван", "user_id": 1}, {"name": "Анна", "user_id": 2}]
        bot_module.save_poll_state({"polls": {"p": poll(
            message_id=123, answers={"1": answer("Иван", [0])},
        )}})
        with patch.object(bot_module, "TEAM_ROSTER", roster):
            await bot_module.send_game_day_summaries(now=datetime(2026, 9, 30, 17, 0, tzinfo=MOSCOW))
        sent = self.sender.await_args.kwargs
        self.assertEqual(sent["reply_parameters"].message_id, 123)
        self.assertTrue(sent["reply_parameters"].allow_sending_without_reply)
        self.assertIn('<a href="tg://user?id=2">Анна</a>', sent["text"])
        self.assertNotIn("tg://user?id=1", sent["text"])

    async def test_team_message_and_poll_answer_save_user_binding(self):
        roster = [{"name": "Иван"}, {"name": "Анна"}]
        ivan = bot_module.types.User(id=1, is_bot=False, first_name="Иван")
        anna = bot_module.types.User(id=2, is_bot=False, first_name="Анна", username="anna")
        with patch.object(bot_module, "TEAM_ROSTER", roster):
            await bot_module.handle_team_message(SimpleNamespace(from_user=ivan))
            await bot_module.handle_poll_answer(bot_module.types.PollAnswer(
                poll_id="p", user=anna, option_ids=[0], option_persistent_ids=["option-0"],
            ))
        state = bot_module.load_poll_state()
        self.assertEqual(state["team_users"][str(CHAT)]["1"]["roster_name"], "Иван")
        self.assertEqual(state["team_users"][str(CHAT)]["2"]["username"], "anna")
        self.assertEqual(state["polls"]["p"]["answers"]["2"]["full_name"], "Анна")
        self.sender.assert_not_awaited()

    async def test_startup_persists_legacy_binding_across_rename(self):
        bot_module.save_poll_state({"polls": {"p": poll(answers={"1": answer("Иван ⚽", [0])})}})
        with (
            patch.object(bot_module, "TEAM_ROSTER", [{"name": "Иван"}]),
            patch.object(bot_module, "bot", SimpleNamespace(set_my_commands=AsyncMock())),
            patch.object(bot_module.asyncio, "create_task", side_effect=lambda coroutine: coroutine.close()),
        ):
            await bot_module.on_startup()
            renamed = bot_module.types.User(id=1, is_bot=False, first_name="Новое имя")
            await bot_module.handle_team_message(SimpleNamespace(from_user=renamed))
        state = bot_module.load_poll_state()
        self.assertEqual(state["team_users"][str(CHAT)]["1"]["roster_name"], "Иван")
        self.assertEqual(state["team_users"][str(CHAT)]["1"]["full_name"], "Новое имя")

    async def test_multipart_poll_saves_dates_without_losing_existing_votes(self):
        events = [{"name": f"Квиз {i}", "time": "20:00", "event_date": TODAY} for i in range(12)]
        calls = 0
        async def send_poll(**kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                state = bot_module.load_poll_state()
                state["polls"]["new1"]["answers"]["8"] = answer("Быстрый", [0])
                bot_module.save_poll_state(state)
            return SimpleNamespace(poll=SimpleNamespace(id=f"new{calls}"), message_id=calls)
        with patch.object(bot_module, "bot", SimpleNamespace(send_poll=send_poll)):
            await bot_module.send_weekly_poll(events, reference=TODAY)
        state = bot_module.load_poll_state()
        self.assertEqual(state["polls"]["new1"]["events"]["0"]["event_date"], TODAY.isoformat())
        self.assertIn("8", state["polls"]["new1"]["answers"])
        self.assertEqual(len(state["polls"]["new2"]["events"]), 1)

    def test_failed_atomic_save_preserves_previous_state(self):
        before = copy.deepcopy(bot_module.load_poll_state())
        with patch.object(bot_module.os, "replace", side_effect=OSError("disk error")):
            with self.assertLogs(level="ERROR"), self.assertRaises(OSError):
                bot_module.save_poll_state({"polls": {}})
        self.assertEqual(bot_module.load_poll_state(), before)


if __name__ == "__main__":
    unittest.main()
