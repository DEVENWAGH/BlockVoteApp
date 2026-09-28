"""Build an IEEE-styled Word version of a paper from its IEEEtran LaTeX source.

Usage: python build_docx.py BlockVote_IEEE_merged.tex BlockVote_IEEE_merged.docx

Pandoc does the LaTeX -> DOCX conversion; this script prepares the source
(numbering, citations, algorithm, author block) and then restyles the DOCX
(Times New Roman, two-column body, full-width figure*/table*).
"""
import os
import re
import shutil
import subprocess
import sys
import zipfile

PANDOC = os.path.join(os.environ["LOCALAPPDATA"], "pandoc", "pandoc-3.11", "pandoc.exe")
EMU_PER_TWIP = 635
COL_GAP = 288
TNR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'


def roman(n):
    vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


def balanced(text, start):
    """Return index just past the brace group opening at text[start] == '{'."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError("unbalanced braces")


def parse_authors(tex):
    start = tex.index("\\author{")
    end = balanced(tex, start + len("\\author"))
    block = tex[start + len("\\author{"): end - 1]
    authors = []
    for part in block.split("\\and"):
        name = re.search(r"\\IEEEauthorblockN\{(.*?)\}", part).group(1).replace("\\ ", " ")
        a_start = part.index("\\IEEEauthorblockA{")
        a_end = balanced(part, a_start + len("\\IEEEauthorblockA"))
        lines = part[a_start + len("\\IEEEauthorblockA{"): a_end - 1].split("\\\\")
        info = []
        for line in lines:
            line = line.strip()
            m = re.fullmatch(r"\\textit\{(.*)\}", line)
            info.append((m.group(1) if m else line, bool(m)))
        authors.append((name, info))
    return tex[:start] + tex[end:], authors


def number_labels(tex):
    labels = {}
    sec = sub = fig = tab = eq = alg = 0
    current = None
    token = re.compile(
        r"\\section\{|\\subsection\{|\\begin\{(figure\*?|table\*?|equation|algorithm)\}|\\label\{([^}]+)\}"
    )
    for m in token.finditer(tex):
        s = m.group(0)
        if s == "\\section{":
            sec += 1
            sub = 0
            current = roman(sec)
        elif s == "\\subsection{":
            sub += 1
            current = f"{roman(sec)}-{chr(64 + sub)}"
        elif m.group(1):
            env = m.group(1).rstrip("*")
            if env == "figure":
                fig += 1
                current = str(fig)
            elif env == "table":
                tab += 1
                current = roman(tab)
            elif env == "equation":
                eq += 1
                current = str(eq)
            else:
                alg += 1
                current = str(alg)
        elif m.group(2):
            labels[m.group(2)] = current
    return labels


def preprocess(tex):
    tex = tex.replace("\\newcommand{\\cmark}{\\ding{51}}", "\\newcommand{\\cmark}{✓}")
    tex = tex.replace("\\newcommand{\\xmark}{\\ding{55}}", "\\newcommand{\\xmark}{✗}")
    tex = tex.replace("\\newcommand{\\pmark}{$\\circ$}", "\\newcommand{\\pmark}{○}")
    tex = re.sub(r"\\includegraphics(\[[^\]]*\])?\{(fig_\w+)\.pdf\}", r"\\includegraphics\1{figures/\2.png}", tex)
    tex = tex.replace("\\resizebox{\\textwidth}{!}{%", "").replace("\\end{tabular}}", "\\end{tabular}")

    tex, authors = parse_authors(tex)
    labels = number_labels(tex)

    keys = re.findall(r"\\bibitem\{([^}]+)\}", tex)
    cite_no = {k: i + 1 for i, k in enumerate(keys)}

    def cite(m):
        nums = sorted(cite_no[k.strip()] for k in m.group(1).split(","))
        groups, run = [], [nums[0]]
        for n in nums[1:]:
            if n == run[-1] + 1:
                run.append(n)
            else:
                groups.append(run)
                run = [n]
        groups.append(run)
        parts = []
        for g in groups:
            if len(g) >= 3:
                parts.append(f"[{g[0]}]–[{g[-1]}]")
            else:
                parts.extend(f"[{n}]" for n in g)
        return ", ".join(parts)

    tex = re.sub(r"\\cite\{([^}]+)\}", cite, tex)
    tex = re.sub(r"\\ref\{([^}]+)\}", lambda m: labels[m.group(1)], tex)

    counters = {"sec": 0, "sub": 0}

    def heading(m):
        if m.group(1) == "section":
            counters["sec"] += 1
            counters["sub"] = 0
            return f"\\section*{{{roman(counters['sec'])}. {m.group(2)}}}"
        counters["sub"] += 1
        return f"\\subsection*{{{chr(64 + counters['sub'])}. {m.group(2)}}}"

    tex = re.sub(r"\\(section|subsection)\{([^}]*)\}", heading, tex)

    fig_tab = {"figure": 0, "table": 0}

    def env_caption(m):
        env = m.group(1).rstrip("*")
        fig_tab[env] += 1
        prefix = f"TABLE {roman(fig_tab[env])}. " if env == "table" else f"Fig. {fig_tab[env]}. "
        body = m.group(0).replace("\\caption{", "\\caption{" + prefix, 1)
        if m.group(1).endswith("*"):
            body = "\n\nWIDESTART\n\n" + body + "\n\nWIDEEND\n\n"
        return body

    tex = re.sub(r"\\begin\{(figure\*?|table\*?)\}.*?\\end\{\1\}", env_caption, tex, flags=re.S)

    eq_no = [0]

    def equation(m):
        eq_no[0] += 1
        body = re.sub(r"\\label\{[^}]+\}", "", m.group(1)).strip()
        return f"\\[ {body} \\qquad ({eq_no[0]}) \\]"

    tex = re.sub(r"\\begin\{equation\}(.*?)\\end\{equation\}", equation, tex, flags=re.S)

    tex = re.sub(
        r"\\begin\{algorithm\}.*?\\end\{algorithm\}",
        lambda m: ALGORITHM,
        tex,
        flags=re.S,
    )

    front = ""
    if "\\IEEEaftertitletext{" in tex:
        start = tex.index("\\IEEEaftertitletext{")
        end = balanced(tex, start + len("\\IEEEaftertitletext"))
        front = tex[start + len("\\IEEEaftertitletext{"): end - 1].lstrip("%")
        front = re.sub(r"\\vspace\{[^}]*\}", "", front)
        tex = tex[:start] + tex[end:]
    tex = tex.replace("\\maketitle", "\\maketitle\n\nAUTHORSBLOCK\n\n" + front + "\n\nFRONTEND\n\n")

    tex = tex.replace("\\begin{thebibliography}{00}", "\\section*{References}\n")
    tex = tex.replace("\\end{thebibliography}", "")
    tex = re.sub(r"\\bibitem\{([^}]+)\}", lambda m: f"\n\nREFITEM[{cite_no[m.group(1)]}] ", tex)
    return tex, authors


ALGORITHM = r"""

\noindent\textbf{Algorithm 1.} Atomic vote-slot reservation

\noindent \textbf{Require:} voter id $v$, channel $\in\{\text{app},\text{station}\}$, $M=2$

\noindent \textbf{1:} $F \gets \{\_id = v,\ \text{stationVoteFinal} \neq \text{true}\}$

\noindent \textbf{2:} \textbf{if} channel $=$ app \textbf{then} $F \gets F \wedge \neg(\text{votesCast} \geq M)$

\noindent \textbf{3:} $U \gets \{\text{votesCast} \mathrel{+}= 1\}$

\noindent \textbf{4:} \textbf{if} channel $=$ station \textbf{then} $U \gets U \cup \{\text{stationVoteFinal} \gets \text{true}\}$

\noindent \textbf{5:} $b \gets \mathrm{FindOneAndUpdate}(F, U, \text{return before})$

\noindent \textbf{6:} \textbf{if} $b = \bot$ \textbf{then return} reject (VOTE\_LIMIT\_REACHED or STATION\_VOTE\_FINAL)

\noindent \textbf{7:} $r \gets \mathrm{RelayCastVote}(\cdot)$

\noindent \textbf{8:} \textbf{if} $r$ failed \textbf{then} restore the voter document to $b$ (release slot)

"""


def style(style_id, name, ppr, rpr, based="Normal", kind="paragraph", fonts=TNR):
    attrs = 'w:default="1"' if style_id == "Normal" else 'w:customStyle="1"'
    based_xml = f'<w:basedOn w:val="{based}"/>' if based else ""
    ppr_xml = f"<w:pPr>{ppr}</w:pPr>" if kind == "paragraph" else ""
    return (
        f'<w:style w:type="{kind}" {attrs} w:styleId="{style_id}"><w:name w:val="{name}"/>'
        f"{based_xml}<w:qFormat/>{ppr_xml}<w:rPr>{fonts}{rpr}</w:rPr></w:style>"
    )


BODY_PPR = '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="202"/><w:jc w:val="both"/>'
STYLES = {
    "Normal": style("Normal", "Normal", '<w:spacing w:before="0" w:after="0"/>', '<w:sz w:val="20"/><w:szCs w:val="20"/>', based=""),
    "BodyText": style("BodyText", "Body Text", BODY_PPR, ""),
    "FirstParagraph": style("FirstParagraph", "First Paragraph", BODY_PPR, "", based="BodyText"),
    "Compact": style("Compact", "Compact", '<w:spacing w:before="0" w:after="0"/><w:jc w:val="both"/>', "", based="BodyText"),
    "Title": style("Title", "Title", '<w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/>', '<w:sz w:val="48"/><w:szCs w:val="48"/>'),
    "Heading1": style(
        "Heading1", "heading 1",
        '<w:keepNext/><w:spacing w:before="160" w:after="80"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>',
        '<w:smallCaps/><w:sz w:val="20"/>',
    ),
    "Heading2": style(
        "Heading2", "heading 2",
        '<w:keepNext/><w:spacing w:before="120" w:after="60"/><w:outlineLvl w:val="1"/>',
        '<w:i/><w:sz w:val="20"/>',
    ),
    "TableCaption": style("TableCaption", "Table Caption", '<w:keepNext/><w:spacing w:before="120" w:after="60"/><w:jc w:val="center"/>', '<w:smallCaps/><w:sz w:val="16"/>'),
    "ImageCaption": style("ImageCaption", "Image Caption", '<w:spacing w:before="60" w:after="160"/><w:jc w:val="both"/>', '<w:sz w:val="16"/>'),
    "CaptionedFigure": style("CaptionedFigure", "Captioned Figure", '<w:keepNext/><w:spacing w:before="120"/><w:jc w:val="center"/>', ""),
    "TableText": style("TableText", "Table Text", '<w:spacing w:before="0" w:after="0"/>', '<w:sz w:val="16"/><w:szCs w:val="16"/>'),
    "Reference": style("Reference", "Reference", '<w:spacing w:before="0" w:after="20"/><w:ind w:left="360" w:hanging="360"/><w:jc w:val="both"/>', '<w:sz w:val="16"/><w:szCs w:val="16"/>'),
    "FrontText": style("FrontText", "Front Text", '<w:spacing w:before="0" w:after="160"/><w:jc w:val="both"/>', ""),
    "AuthorText": style("AuthorText", "Author Text", '<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/>', ""),
    "VerbatimChar": style(
        "VerbatimChar", "Verbatim Char", "", '<w:sz w:val="17"/><w:szCs w:val="17"/>', based="", kind="character",
        fonts='<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>',
    ),
}


def restyle(styles_xml):
    styles_xml = re.sub(r"<w:rFonts [^>]*/>", TNR, styles_xml)
    styles_xml = re.sub(r'<w:color w:val="[0-9A-Fa-f]{6}"[^>]*/>', "", styles_xml)
    styles_xml = re.sub(
        r"(<w:rPrDefault>.*?)<w:sz w:val=\"\d+\"\s*/>", r'\1<w:sz w:val="20"/>', styles_xml, count=1, flags=re.S
    )
    for sid, xml in STYLES.items():
        pattern = re.compile(rf'<w:style [^>]*w:styleId="{sid}"[^>]*>.*?</w:style>', re.S)
        if pattern.search(styles_xml):
            styles_xml = pattern.sub(lambda _m: xml, styles_xml, count=1)
        else:
            styles_xml = styles_xml.replace("</w:styles>", xml + "</w:styles>")
    return styles_xml


AUTHOR_CELL_TWIPS = 2333


def author_table(authors):
    """One row, one fixed-width column per author: name 11 pt, affiliation 10 pt italic."""

    def esc(text):
        return text.replace("&", "&amp;").replace("<", "&lt;")

    def cell(author):
        name, info = author
        name_p = (
            '<w:p><w:pPr><w:pStyle w:val="AuthorText"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(name)}</w:t></w:r></w:p>'
        )
        runs = "".join(
            f'<w:r><w:rPr><w:i/></w:rPr>{"<w:br/>" if i else ""}<w:t xml:space="preserve">{esc(t)}</w:t></w:r>'
            for i, (t, _) in enumerate(info)
        )
        aff_p = f'<w:p><w:pPr><w:pStyle w:val="AuthorText"/></w:pPr>{runs}</w:p>'
        return (
            f'<w:tc><w:tcPr><w:tcW w:w="{AUTHOR_CELL_TWIPS}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>'
            f"{name_p}{aff_p}</w:tc>"
        )

    grid = "".join(f'<w:gridCol w:w="{AUTHOR_CELL_TWIPS}"/>' for _ in authors)
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/>'
        '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/>'
        '<w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
        '<w:tblLayout w:type="fixed"/></w:tblPr>'
        f"<w:tblGrid>{grid}</w:tblGrid><w:tr>" + "".join(cell(a) for a in authors) + "</w:tr></w:tbl><w:p/>"
    )


def para_containing(xml, marker):
    idx = xml.index(marker)
    start = max(xml.rfind("<w:p>", 0, idx), xml.rfind("<w:p ", 0, idx))
    end = xml.index("</w:p>", idx) + len("</w:p>")
    return start, end


def postprocess(docx_path, authors):
    with zipfile.ZipFile(docx_path) as z:
        files = {n: z.read(n) for n in z.namelist()}
    xml = files["word/document.xml"].decode("utf-8")

    sect = re.search(r"<w:sectPr\b(?:(?!<w:sectPr).)*?</w:sectPr>\s*</w:body>", xml, re.S).group(0)
    sect = sect[: sect.rindex("</w:sectPr>") + len("</w:sectPr>")]
    pg_w, left, right = 12240, 900, 900
    pg_sz = f'<w:pgSz w:w="{pg_w}" w:h="15840"/>'
    pg_mar = f'<w:pgMar w:top="1080" w:right="{right}" w:bottom="1440" w:left="{left}" w:header="720" w:footer="720" w:gutter="0"/>'
    text_emu = (pg_w - left - right) * EMU_PER_TWIP
    col_emu = (pg_w - left - right - COL_GAP) // 2 * EMU_PER_TWIP

    def breaker(cols):
        cols_xml = f'<w:cols w:num="2" w:space="{COL_GAP}"/>' if cols == 2 else '<w:cols w:space="720"/>'
        return f'<w:p><w:pPr><w:sectPr><w:type w:val="continuous"/>{pg_sz}{pg_mar}{cols_xml}</w:sectPr></w:pPr></w:p>'

    s, e = para_containing(xml, "AUTHORSBLOCK")
    xml = xml[:s] + author_table(authors) + xml[e:]

    for label in ("Abstract:", "Keywords:"):
        s, e = para_containing(xml, label)
        p = re.sub(r'<w:pStyle w:val="[^"]+"\s*/>', '<w:pStyle w:val="FrontText"/>', xml[s:e], count=1)
        xml = xml[:s] + p + xml[e:]
    s, e = para_containing(xml, "FRONTEND")
    xml = xml[:s] + breaker(1) + xml[e:]

    while "WIDESTART" in xml:
        s, e = para_containing(xml, "WIDESTART")
        xml = xml[:s] + breaker(2) + xml[e:]
        s, e = para_containing(xml, "WIDEEND")
        xml = xml[:s] + breaker(1) + xml[e:]

    final = f'<w:sectPr><w:type w:val="continuous"/>{pg_sz}{pg_mar}<w:cols w:num="2" w:space="{COL_GAP}"/></w:sectPr>'
    xml = xml.replace(sect, final)

    # Scale drawings: full text width inside single-column sections, column width elsewhere.
    out, pos, width = [], 0, col_emu
    marker = re.compile(r"<w:drawing>.*?</w:drawing>|<w:sectPr>.*?</w:sectPr>", re.S)
    positions = []
    for m in marker.finditer(xml):
        positions.append(m)
    # A drawing belongs to the section whose sectPr follows it.
    for i, m in enumerate(positions):
        if not m.group(0).startswith("<w:drawing>"):
            continue
        nxt = next(p for p in positions[i + 1:] if p.group(0).startswith("<w:sectPr>"))
        limit = text_emu if 'w:num="2"' not in nxt.group(0) else col_emu
        block = m.group(0)
        ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', block)
        if ext:
            cx, cy = int(ext.group(1)), int(ext.group(2))
            if cx > limit:
                ncy = int(cy * limit / cx)
                block = block.replace(f'cx="{cx}" cy="{cy}"', f'cx="{limit}" cy="{ncy}"')
        out.append(xml[pos:m.start()])
        out.append(block)
        pos = m.end()
    out.append(xml[pos:])
    xml = "".join(out)

    # Table cell text in 8 pt (skip the author table, which uses AuthorText).
    xml = re.sub(
        r"<w:tbl>.*?</w:tbl>",
        lambda m: m.group(0).replace('<w:pStyle w:val="Compact" />', '<w:pStyle w:val="TableText" />')
        .replace('<w:pStyle w:val="Compact"/>', '<w:pStyle w:val="TableText"/>'),
        xml,
        flags=re.S,
    )

    # Reference list paragraphs.
    def ref_para(m):
        p = m.group(0).replace("REFITEM", "", 1)
        p = re.sub(r'<w:pStyle w:val="[^"]+"\s*/>', '<w:pStyle w:val="Reference"/>', p, count=1)
        if "<w:pStyle" not in p:
            p = re.sub(r"^<w:p( [^>]*)?>", lambda mm: mm.group(0) + '<w:pPr><w:pStyle w:val="Reference"/></w:pPr>', p)
        return p

    xml = re.sub(r"<w:p(?: [^>]*)?>(?:(?!</w:p>).)*?REFITEM.*?</w:p>", ref_para, xml, flags=re.S)

    files["word/document.xml"] = xml.encode("utf-8")
    files["word/styles.xml"] = restyle(files["word/styles.xml"].decode("utf-8")).encode("utf-8")

    tmp = docx_path + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    shutil.move(tmp, docx_path)


def main(tex_path, docx_path):
    with open(tex_path, encoding="utf-8") as f:
        tex, authors = preprocess(f.read())
    src = "_docx_src.tex"
    with open(src, "w", encoding="utf-8") as f:
        f.write(tex)
    try:
        subprocess.run(
            [PANDOC, src, "-f", "latex", "-t", "docx", "-o", docx_path, "--resource-path=.;figures"],
            check=True,
        )
    finally:
        os.remove(src)
    postprocess(docx_path, authors)
    print("wrote", docx_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
