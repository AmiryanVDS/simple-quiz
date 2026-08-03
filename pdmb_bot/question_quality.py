"""Validation and de-duplication for trainer questions."""

import re
import unicodedata
from datetime import date


REQUIRED_METADATA = ("source", "source_url", "license", "checked_at")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", " ", value).strip().casefold()


def validate_question(question: dict) -> bool:
    if not isinstance(question, dict):
        return False
    if not isinstance(question.get("question"), str) or not question["question"].strip():
        return False
    options = question.get("options")
    correct = question.get("correct")
    if not isinstance(options, list) or len(options) != 4:
        return False
    if not all(isinstance(option, str) and option.strip() for option in options):
        return False
    if len({normalize(option) for option in options}) != 4:
        return False
    if not isinstance(correct, int) or not 0 <= correct < len(options):
        return False
    if not isinstance(question.get("explanation"), str) or not question["explanation"].strip():
        return False
    if question.get("answer_verified") is not True:
        return False
    if any(not isinstance(question.get(field), str) or not question[field].strip() for field in REQUIRED_METADATA):
        return False
    try:
        date.fromisoformat(question["checked_at"])
    except ValueError:
        return False
    return True


def deduplicate_questions(questions: list[dict]) -> tuple[list[dict], dict[str, int]]:
    """Return valid unique questions and a small quality report."""
    unique = []
    seen = set()
    report = {"input": 0, "valid": 0, "invalid": 0, "duplicates": 0}
    for question in questions:
        report["input"] += 1
        if not validate_question(question):
            report["invalid"] += 1
            continue
        report["valid"] += 1
        key = (normalize(question["question"]), tuple(sorted(normalize(option) for option in question["options"])))
        if key in seen:
            report["duplicates"] += 1
            continue
        seen.add(key)
        unique.append(question)
    return unique, report
