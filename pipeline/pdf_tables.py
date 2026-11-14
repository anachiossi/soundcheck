"""pdf_tables.py — a PDF's pages as plain data: the printed lines in reading order, and the tables with
their rows and cells (found by the PDF library, PyMuPDF). The only part of the table reader that touches the PDF;
read_odg_table.py works on what this gives, so its rules can be tested without a PDF.
Used by: read_odg_table.py
"""

from read_odg import clean


def without_stray_letters(text):
    """A watermark printed down the page leaves single letters on their own line inside the cells
    ("s⏎Programma del giorno…", "D⏎164", Il colpo): dropped when the cell has real text too."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if any(len(line) > 2 for line in lines):
        lines = [line for line in lines if len(line) > 1 or not line.isalpha()]
    return "\n".join(lines)


def in_reading_order(placed):
    """[(y, x, text)] → top to bottom, and left to right for what is printed at the same height (within 3 points:
    a label and its time on one row don't always share the exact height)."""
    rows = []
    for y, x, text in sorted(placed):
        if rows and y - rows[-1][0] < 3:
            rows[-1][1].append((x, y, text))
        else:
            rows.append((y, [(x, y, text)]))
    return [(y, x, text) for _, row in rows for x, y, text in sorted(row)]


def pages_of(path):
    """The PDF → the plain pages read_table_pages wants (the only part that needs the PDF library)."""
    import pymupdf as fitz
    pages = []
    for page in fitz.open(path):
        placed = []  # (height on the page, text) of every printed line
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = clean("".join(span["text"] for span in line["spans"]))
                if len(text) > 1 or not text.isalpha():  # a lone letter: the watermark
                    placed.append((line["bbox"][1], line["bbox"][0], text))
        placed = [line for line in in_reading_order(placed) if line[2]]
        tables = []
        for table in page.find_tables().tables:
            rows = []
            for row, texts in zip(table.rows, table.extract()):
                cells = [{"x0": box[0], "x1": box[2], "text": without_stray_letters(text)}
                         for box, text in zip(row.cells, texts) if box and text and without_stray_letters(text)]
                if cells:
                    rows.append(cells)
            top = table.bbox[1]
            tables.append({"line": sum(1 for y, _, _ in placed if y < top - 1), "rows": rows})
        pages.append({"lines": [text for _, _, text in placed], "tables": sorted(tables, key=lambda t: t["line"])})
    return pages
