import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pdmb_bot"))
from sport_filter import filter_sport_quizzes


class SportFilterTests(unittest.TestCase):
    def test_dedicated_organizer_or_explicit_sports_title(self):
        events = [
            {"name": "Классический тур", "org": "Футбольный квиз Удар головой"},
            {"name": "Лига Крокозавра", "org": "ПроСпорт"},
            {"name": "Футбол (ПОВТОР)", "org": "МЯУ КВИЗ"},
            {"name": "Спорт", "org": "Brainboy"},
            {"name": "Игра #1021.2", "org": "Squiz"},
            {"name": "РОК И ВИДЕОИГРЫ", "org": "Теория большого квиза"},
            {"name": "КМС (ПОВТОР)", "org": "BUBO-КВИЗ"},
            {"name": "Квиз Плюс — КЧАУ", "org": "Квиз Плюс", "source_channel": "quizplusmsk"},
            {"name": "Ответная игра", "org": "Ответная игра", "source_channel": "simple_quiz"},
        ]
        self.assertEqual(
            [event["name"] for event in filter_sport_quizzes(events)],
            ["Классический тур", "Лига Крокозавра", "Футбол (ПОВТОР)", "Спорт", "Квиз Плюс — КЧАУ", "Ответная игра"],
        )

    def test_normalization_and_word_boundary(self):
        events = [
            {"name": "ХОККЕЙ — финал", "org": "Неизвестный"},
            {"name": "Тур", "org": "  ФУТБОЛЬНЫЙ квиз «Удар головой»  "},
            {"name": "Киберспорт", "org": "Неизвестный"},
            {"name": "Кино и музыка", "org": None},
        ]
        self.assertEqual(
            [event["name"] for event in filter_sport_quizzes(events)],
            ["ХОККЕЙ — финал", "Тур"],
        )
