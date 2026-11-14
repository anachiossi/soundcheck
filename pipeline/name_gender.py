"""name_gender.py — a character's gender guessed from the ACTOR's first name ("Sandro Cecere" → M), for films
whose lav rule goes by gender (settings "presets" → "lav_rules" → "by_gender"; Il colpo: girls Sanken, boys 6060).
Ana, 14 Nov: "predict gender by the actor's name".

It is a prediction, so the proposal says so in words and Ana accepts or rejects it like any other change:
  1. a first name in the lists below → that gender
  2. else an Italian ending: …a → F, …o → M
  3. else nothing (never a guess beyond that: "Khadim", "Ronia" stay empty)
Used by: compare.py (check_cast_list)
"""

FEMALE = set("""
adele alice angela anna asia beatrice bianca carlotta carmen caterina chiara cristina elena emma ester
federica francesca gaia giulia ines irene isabel isabella jasmine laura lucia margherita maria marta matilde
miriam nicole noemi rachele rita rosa sara sofia valentina valeria vittoria
""".split())

MALE = set("""
alessandro andrea antonio daniele davide elia emanuele enea enrico gabriel gabriele giancarlo gianni giordano
giovanni giuseppe luca manuel marco mattia michael michele nicola pietro raffaele riccardo salvatore samuele
sandro sergio simone tobia tommaso valerio
""".split())


def gender_from_actor(actor):
    """'Rosa Diletta Rossi' → 'F' · 'Nicola Pistoia' → 'M' · 'Khadim Faye' → '' (not known: nothing)."""
    words = (actor or "").strip().lower().split()
    if not words:
        return ""
    first = words[0].strip(".,")
    if first in FEMALE:
        return "F"
    if first in MALE:
        return "M"
    if len(first) > 2 and first.endswith("a"):
        return "F"
    if len(first) > 2 and first.endswith("o"):
        return "M"
    return ""
