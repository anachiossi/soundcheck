"""crew_colors.py — the colour of a crew member's IFB tag, from their job: the colours Ana has used on every film
(LBE, Il colpo), so a new film's crew list starts coloured "as we are used to" (Ana, 5 Nov, Confine).

    producers red · director blue · production office purple / lilac · assistant directors cyan / light cyan ·
    DOP dark green · camera green · stills olive · sound and post violet · art department sand ·
    costume, make-up, hair pink · gaffer yellow · electricians and grips straw · stunts lavender ·
    SFX / VFX orange · everyone else (drivers, trucks, office) light grey

    color_for("Ass. Operatore", "FOTOGRAFIA") → '#59d16c'
Used by: compare_crew.py (people added from an ODG)
"""

import re
import unicodedata

OTHERS = "#e8e4e1"
# (colour, words of the job) — the first that matches wins, so the narrow jobs come before the wide ones
RULES = (
    ("#e81e1e", r"produtt|delegat. di produzione"),
    ("#4561ff", r"^regist"),
    ("#ff9f45", r"\bsfx\b|\bvfx\b|effetti|armier"),
    ("#d98cff", r"stunt"),
    ("#40bd62", r"^dop$|direttor. della fotografia"),
    ("#add868", r"fotografo di scena"),
    ("#59d16c", r"operator|\bdit\b|data manag|video assist|backstage|\bmdp\b|trainee"),
    ("#ae72d4", r"fonic|microfonist|sound|suono|montat|post.?produzione|near set|music|compositor"),
    ("#ffabcc", r"costum|sart|trucc|parruc|make.?up"),
    ("#fae039", r"(capo|c\.?\s*sq\.?|csq).*elettric"),
    ("#ebdf88", r"elettric|macchinist|\b75q\b"),
    ("#e3b77b", r"scenograf|arredat|arredament|attrezzist|\battr\.|\bbuyer\b|grafic|pittor"),
    ("#6fd0e3", r"(\bii\b|second).*(regi|casting)|location|editoriale|pianificazione|tirocinante|^(a\.?to|ass\.) regia"),
    ("#1fb5cf", r"regia|aiuto regist|segretari. di ediz|casting|acting coach|intimacy|aosm|generici"),
    ("#d7b1e0", r"^(aiuto|a\.?to|ass\.?|assistente)\s.*(segr|coordin|prod)|ispettor|facilities|clearance|runner|^assistente id"),
    ("#d959e6", r"di produzione|di prod\b|coordinatric. di prod|organizzat"),
)
DEPARTMENTS = {"fotografia": "#59d16c", "sonoro": "#ae72d4", "suono": "#ae72d4", "costumi": "#ffabcc",
               "scenografia": "#e3b77b", "regia": "#6fd0e3", "produzione": "#d7b1e0", "macchinisti": "#ebdf88",
               "elettricisti": "#ebdf88"}


def plain(text):
    """'II° Aiuto Regia' → 'ii aiuto regia' (no accents, no °, small letters)."""
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.lower()).strip()


def color_for(role, department=""):
    """The tag colour for a job ('Ass. Operatore'); the department ('FOTOGRAFIA'), or the job's own words
    ('Manovale Scenografia'), when the job alone doesn't say."""
    job = plain(role)
    if re.match(r"(autista|camion|gruppista|cassier)", job):
        return OTHERS
    for color, words in RULES:
        if re.search(words, job):
            return color
    for word, color in DEPARTMENTS.items():
        if word in job:
            return color
    return DEPARTMENTS.get(plain(department), OTHERS)
