import copy
import json
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
from poll_summary import build_game_day_reminder

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


class ReminderTests(unittest.TestCase):
    def test_one_message_links_each_game_to_its_poll(self):
        first = poll(
            options=["30.09 (СР) 20:00 — Видеоигры", "❌ Не иду"],
            message_id=123,
        )
        second = poll(
            options=["30.09 (СР) 20:00 — Спортивный квиз", "❌ Не иду"],
            message_id=456,
        )
        duplicate = poll(
            options=["30.09 (СР) 20:00 — Видеоигры", "❌ Не иду"],
            message_id=100,
        )
        state = {"polls": {"first": first, "second": second, "old": duplicate}}
        reminder = build_game_day_reminder(state, CHAT, TODAY)
        self.assertEqual(reminder["poll_message_id"], 123)
        self.assertIn("Сегодня квизы", reminder["text"])
        self.assertEqual(reminder["text"].count("Видеоигры"), 1)
        self.assertIn('href="https://t.me/c/123/123"', reminder["text"])
        self.assertIn('href="https://t.me/c/123/456"', reminder["text"])
        self.assertIn("до начала квиза", reminder["text"])

    def test_only_today_and_correct_chat(self):
        state = {"polls": {
            "p": poll(message_id=123),
            "other": poll(message_id=999, chat_id=42),
        }}
        reminder = build_game_day_reminder(state, CHAT, TODAY)
        self.assertIn("Сегодня квиз", reminder["text"])
        self.assertNotIn("Футбол", reminder["text"])
        self.assertNotIn("/999", reminder["text"])
        self.assertIsNone(build_game_day_reminder(state, CHAT, date(2026, 10, 1)))


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
        bot_module.save_poll_state({"polls": {"p": poll()}})

    async def test_morning_reminder_catches_up_once(self):
        state = bot_module.load_poll_state()
        state["polls"]["p"]["message_id"] = 123
        bot_module.save_poll_state(state)
        self.assertFalse(await bot_module.send_game_day_reminder(
            now=datetime(2026, 9, 30, 9, 59, tzinfo=MOSCOW)))
        self.assertTrue(await bot_module.send_game_day_reminder(
            now=datetime(2026, 9, 30, 12, 30, tzinfo=MOSCOW)))
        self.assertFalse(await bot_module.send_game_day_reminder(
            now=datetime(2026, 9, 30, 16, 59, tzinfo=MOSCOW)))
        self.assertEqual(self.sender.await_count, 1)
        self.assertEqual(self.sender.await_args.kwargs["reply_parameters"].message_id, 123)
        saved = bot_module.load_poll_state()
        self.assertIn(f"{CHAT}:2026-09-30", saved["sent_game_reminders"])

    async def test_morning_reminder_skips_after_1700(self):
        self.assertFalse(await bot_module.send_game_day_reminder(
            now=datetime(2026, 9, 30, 17, 0, tzinfo=MOSCOW)))
        self.sender.assert_not_awaited()

    async def test_no_morning_game_can_be_sent_if_poll_arrives_later(self):
        bot_module.save_poll_state({"polls": {}})
        now = datetime(2026, 9, 30, 12, 0, tzinfo=MOSCOW)
        self.assertFalse(await bot_module.send_game_day_reminder(now=now))
        self.assertNotIn("sent_game_reminders", bot_module.load_poll_state())
        bot_module.save_poll_state({"polls": {"p": poll(message_id=123)}})
        self.assertTrue(await bot_module.send_game_day_reminder(now=now))

    async def test_failed_morning_send_retries_and_preserves_concurrent_vote(self):
        async def failed(**kwargs):
            raise RuntimeError("Telegram temporarily unavailable")
        self.sender.side_effect = failed
        now = datetime(2026, 9, 30, 10, 0, tzinfo=MOSCOW)
        with self.assertLogs(level="ERROR"):
            self.assertFalse(await bot_module.send_game_day_reminder(now=now))
        self.assertNotIn("sent_game_reminders", bot_module.load_poll_state())

        async def succeeded(**kwargs):
            state = bot_module.load_poll_state()
            state["polls"]["p"]["answers"]["5"] = answer("Поздний", [0])
            bot_module.save_poll_state(state)
            return SimpleNamespace(message_id=77)
        self.sender.side_effect = succeeded
        self.assertTrue(await bot_module.send_game_day_reminder(now=now))
        self.assertIn("5", bot_module.load_poll_state()["polls"]["p"]["answers"])
        self.assertEqual(self.sender.await_count, 2)

    async def test_monday_keeps_weekly_package(self):
        bot_module.save_poll_state({"polls": {"p": poll()}, "last_schedule_date": None, "last_poll_date": None})
        with patch.object(bot_module, "send_weekly_package", new_callable=AsyncMock) as package:
            await bot_module.run_scheduled_tasks(datetime(2026, 10, 5, 17, 0, tzinfo=MOSCOW))
            package.assert_awaited_once()
        self.sender.assert_not_awaited()

    async def test_monday_game_reminder_links_to_existing_poll(self):
        monday_poll = poll(
            options=["05.10 (ПН) 20:00 — Футбол", "❌ Не иду"],
            message_id=123,
        )
        bot_module.save_poll_state({
            "polls": {"p": monday_poll},
            "last_schedule_date": None,
            "last_poll_date": None,
        })
        with patch.object(bot_module, "send_weekly_package", new_callable=AsyncMock) as package:
            await bot_module.run_scheduled_tasks(datetime(2026, 10, 5, 10, 0, tzinfo=MOSCOW))
            package.assert_awaited_once()
            await bot_module.run_scheduled_tasks(datetime(2026, 10, 5, 10, 1, tzinfo=MOSCOW))
        self.sender.assert_awaited_once()
        self.assertEqual(self.sender.await_args.kwargs["reply_parameters"].message_id, 123)
        self.assertIn("05.10", self.sender.await_args.kwargs["text"])

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


class EventSourceFilteringTests(unittest.TestCase):
    def test_monday_game_is_not_polled_again_next_monday(self):
        monday_game = {"name": "Квиз Плюс — КЧАУ", "event_date": date(2026, 11, 9), "time": "19:30"}
        wednesday_game = {"name": "Классический тур", "event_date": date(2026, 11, 11), "time": "20:00"}
        state = {"polls": {"earlier": {"chat_id": CHAT, "events": {"0": {
            "name": monday_game["name"], "event_date": "2026-11-09", "time": "19:30",
        }}}}}
        self.assertEqual(
            bot_module.unpolled_weekly_events(
                [monday_game, wednesday_game], state, CHAT, reference=date(2026, 11, 9),
            ),
            [wednesday_game],
        )

    def test_github_feed_drops_general_games(self):
        payload = {"ok": True, "events": [
            {"name": "Игра #1021.2", "org": "Squiz", "event_date": "2026-11-03"},
            {"name": "РОК И ВИДЕОИГРЫ", "org": "Теория большого квиза", "event_date": "2026-11-03"},
            {"name": "Классический тур", "org": "Футбольный квиз Удар головой", "event_date": "2026-11-11"},
            {"name": "Квиз Плюс — КЧАУ", "org": "Квиз Плюс", "event_date": "2026-11-09",
             "source_channel": "quizplusmsk", "event_url": "https://t.me/quizplusmsk/5280"},
        ]}
        events = bot_module._events_from_api_payload(payload)
        self.assertEqual([event["name"] for event in events], ["Классический тур", "Квиз Плюс — КЧАУ"])
        self.assertIn("https://t.me/quizplusmsk/5280", bot_module.format_quiz_schedule(events))

    def test_direct_findquiz_parser_drops_general_games(self):
        page = """
        <li class="top"><h2 class="title">Игра #1021.2</h2><span class="org">Squiz</span></li>
        <li class="top"><h2 class="title">Футбол</h2><span class="org">Смузи</span></li>
        """
        response = SimpleNamespace(text=page, raise_for_status=lambda: None)
        with patch.object(bot_module.requests, "get", return_value=response):
            events = bot_module._fetch_quiz_events_once()
        self.assertEqual([event["name"] for event in events], ["Футбол"])

    def test_old_unfiltered_cache_is_filtered_on_read(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "events.json"
            cache_path.write_text(json.dumps({"events": [
                {"name": "КМС", "org": "BUBO-КВИЗ", "event_date": "2026-09-30"},
                {"name": "Классический тур", "org": "Футбольный квиз Удар головой",
                 "event_date": "2026-09-30"},
            ]}, ensure_ascii=False), encoding="utf-8")
            with patch.object(bot_module, "EVENTS_CACHE_FILE", str(cache_path)):
                events = bot_module.load_events_cache()
                bot_module.save_events_cache(events + [
                    {"name": "Игра #1021.2", "org": "Squiz", "event_date": TODAY},
                ])
                stored = json.loads(cache_path.read_text(encoding="utf-8"))["events"]
        self.assertEqual([event["name"] for event in events], ["Классический тур"])
        self.assertEqual([event["name"] for event in stored], ["Классический тур"])


if __name__ == "__main__":
    unittest.main()
