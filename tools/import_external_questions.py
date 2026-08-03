#!/usr/bin/env python3
"""Import OpenTDB sports questions and openfootball 2026 facts.

The generated JSON is committed so the bot does not call third-party APIs at
runtime. Re-run this script when refreshing the checked dataset.
"""

import html
import json
import re
import ssl
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen

try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pdmb_bot" / "external_questions.json"
LOCAL_OPENTDB = None
LOCAL_OPENFOOTBALL = None
CHECKED_AT = date.today().isoformat()
OPENFOOTBALL_URL = "https://raw.githubusercontent.com/openfootball/worldcup/master/2026--canada-usa-mexico/cup.txt"
OPENTDB_URL = "https://opentdb.com/api.php?" + urlencode({"amount": 50, "category": 21, "type": "multiple", "encode": "url3986"})


def fetch(url: str) -> str:
    if url == OPENTDB_URL and LOCAL_OPENTDB:
        return Path(LOCAL_OPENTDB).read_text(encoding="utf-8")
    if url == OPENFOOTBALL_URL and LOCAL_OPENFOOTBALL:
        return Path(LOCAL_OPENFOOTBALL).read_text(encoding="utf-8")
    request = Request(url, headers={"User-Agent": "simple-quiz-importer/1.0"})
    with urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
        return response.read().decode("utf-8")


def clean(value: str) -> str:
    return html.unescape(unquote(value)).strip()


def import_opentdb() -> list[dict]:
    payload = json.loads(fetch(OPENTDB_URL))
    questions = []
    for item in payload.get("results", []):
        options = [clean(item["correct_answer"])] + [clean(value) for value in item["incorrect_answers"]]
        correct = options[0]
        # Stable shuffle keeps the checked answer index reproducible in the committed file.
        options = sorted(options, key=lambda value: (value.casefold(), value))
        questions.append({
            "question": clean(item["question"]),
            "options": options,
            "correct": options.index(correct),
            "explanation": f"Correct answer: {correct}.",
            "answer_verified": True,
            "source": "Open Trivia DB",
            "source_url": "https://opentdb.com/api_config.php",
            "license": "CC BY-SA 4.0",
            "checked_at": CHECKED_AT,
            "category": "Sports",
            "source_id": f"opentdb:{item.get('question', '')}",
        })
    return questions


def import_openfootball() -> list[dict]:
    text = fetch(OPENFOOTBALL_URL)
    groups = {}
    for line in text.splitlines():
        match = re.match(r"^Group ([A-L])\s*\|\s*(.+)$", line.strip())
        if match:
            teams = re.split(r"\s{2,}", match.group(2).strip())
            groups[match.group(1)] = [team.strip() for team in teams if team.strip()]

    questions = []
    all_teams = [team for teams in groups.values() for team in teams]
    for group, teams in groups.items():
        correct = ", ".join(teams)
        distractors = [", ".join(groups[key]) for key in groups if key != group]
        options = [correct] + distractors[:3]
        questions.append({
            "question": f"Какие сборные входят в группу {group} чемпионата мира 2026?",
            "options": options,
            "correct": 0,
            "explanation": f"Группа {group}: {correct}.",
            "answer_verified": True,
            "source": "openfootball/worldcup",
            "source_url": "https://github.com/openfootball/worldcup",
            "license": "CC0-1.0 (public domain)",
            "checked_at": CHECKED_AT,
            "category": "Football / World Cup 2026",
            "source_id": f"openfootball:2026:group-{group}",
        })

    match_pattern = re.compile(
        r"^\s+\d{1,2}:\d{2}\s+UTC[+-]\d+\s+"
        r"(.+?)\s+(\d+)-(\d+)(?:\s+\([^)]*\))?\s+(.+?)\s+@\s+(.+)$"
    )
    seen_matches = set()
    for line in text.splitlines():
        match = match_pattern.match(line)
        if not match:
            continue
        home, home_score, away_score, away, venue = match.groups()
        home, away, venue = home.strip(), away.strip(), venue.strip()
        key = (home, home_score, away_score, away, venue)
        if key in seen_matches or home not in all_teams or away not in all_teams:
            continue
        seen_matches.add(key)
        score = f"{home_score}:{away_score}"
        score_options = [score]
        for distractor in [f"{away_score}:{home_score}", "0:0", "2:1", "1:2", "3:1"]:
            if distractor not in score_options:
                score_options.append(distractor)
            if len(score_options) == 4:
                break
        questions.append({
            "question": f"Как завершился матч {home} — {away} на ЧМ-2026?",
            "options": score_options,
            "correct": 0,
            "explanation": f"Матч проходил на стадионе {venue}: {home} {home_score}:{away_score} {away}.",
            "answer_verified": True,
            "source": "openfootball/worldcup",
            "source_url": OPENFOOTBALL_URL,
            "license": "CC0-1.0 (public domain)",
            "checked_at": CHECKED_AT,
            "category": "Football / World Cup 2026",
            "source_id": f"openfootball:2026:match:{home}:{away}:{venue}",
        })
    return questions


def main() -> int:
    global LOCAL_OPENTDB, LOCAL_OPENFOOTBALL
    if "--opentdb-file" in sys.argv:
        LOCAL_OPENTDB = sys.argv[sys.argv.index("--opentdb-file") + 1]
    if "--openfootball-file" in sys.argv:
        LOCAL_OPENFOOTBALL = sys.argv[sys.argv.index("--openfootball-file") + 1]
    sys.path.insert(0, str(ROOT / "pdmb_bot"))
    from question_quality import deduplicate_questions

    imported = import_opentdb() + import_openfootball()
    questions, report = deduplicate_questions(imported)
    if report["invalid"] or not questions:
        raise SystemExit(f"Quality check failed: {report}")
    OUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**report, "output": str(OUT)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
