"""Keep sports games from FindQuiz and the two selected quiz channels."""

import re
import unicodedata


# These organizers run dedicated sports quizzes even when a game has a generic
# title such as "Классический тур". Other organizers need an explicit topic.
SPORT_ORGANIZERS = {
    "футбольный квиз удар головой",
    "проспорт",
}
SPORT_CHANNELS = {"simple_quiz", "quizplusmsk"}

SPORT_TITLE = re.compile(
    r"\b(?:спорт\w*|футбол\w*|хокке\w*|баскетбол\w*|волейбол\w*|"
    r"теннис\w*|биатлон\w*|олимпиад\w*|олимпийск\w*|"
    r"рпл|апл|нба|нхл|sport\w*|football\w*)\b"
)


def normalized(value: str | None) -> str:
    text = unicodedata.normalize("NFKC", value or "").casefold().replace("ё", "е")
    return " ".join(re.findall(r"[\w]+", text))


def is_sport_quiz(event: dict) -> bool:
    """Accept a dedicated sports organizer or an explicit sports topic."""
    return (
        event.get("source_channel") in SPORT_CHANNELS
        or normalized(event.get("org")) in SPORT_ORGANIZERS
        or bool(SPORT_TITLE.search(normalized(event.get("name"))))
    )


def filter_sport_quizzes(events: list[dict]) -> list[dict]:
    return [event for event in events if is_sport_quiz(event)]
