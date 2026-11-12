# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Checks the title and description of a pull request that will be squash-merged into main.

Both become the one public commit message, so the check refuses what should not be public: addresses, numbers of
internal trackers, secrets, local paths, mentions of AI tools, and a title that reads oddly in a project history.
Concrete names of internal systems cannot live in this public file: they come from a denylist (one term per line,
`#` starts a comment) that the maintainers keep outside this repository.

Usage (from the repository root):
  uv run scripts/check-pr-text.py message.txt             # first line is the title, then a blank line, then the description
  uv run scripts/check-pr-text.py -                       # the same from stdin
  uv run scripts/check-pr-text.py message.txt --denylist terms.txt --allow-host example.org
  uv run scripts/check-pr-text.py --scan file ... --denylist terms.txt   # only the denylist, for any file
  uv run scripts/check-pr-text.py --self-test

The denylist is taken from --denylist, else from the environment variable PR_TEXT_DENYLIST. Without one the check says
so: names of internal systems are then not checked. Exit code 1 on errors, 2 on a usage error, 0 otherwise.
"""
import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

TITLE_MAX = 60
BODY_MAX_LINES = 3
WRAP = 72
# Prefixes that look like a tracker key (ABC-123) but are not one.
NOT_A_KEY = {"UTF", "SHA", "MD", "ISO", "TLS", "AES", "RSA", "CRC", "IPV", "ES", "H", "WCAG", "RFC", "ARIA", "HTTP", "HTML", "CSS"}

# Names of technologies that look like a host name.
NOT_A_HOST = {"asp.net", "vb.net"}

URL = re.compile(r"https?://[^\s)>\]\"']+", re.IGNORECASE)
HOST = re.compile(r"\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|de|dev|app|cloud|local|internal|corp|lan|example|invalid|test)\b", re.IGNORECASE)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
MENTION = re.compile(r"(?<![\w@/.-])@[A-Za-z][\w.-]*")
REF = [
    re.compile(r"(?<![\w&/])#\d+\b"),
    re.compile(r"(?<![\w!])!\d+\b"),
    re.compile(r"\bAB#\d+\b"),
    re.compile(r"\b(?:PR|pull request|work item)\s*#?\d+\b", re.IGNORECASE),
]
KEY = re.compile(r"\b([A-Z][A-Z0-9]{1,9})-\d+\b")
SECRET = [
    re.compile(r"\b(?:password|passwd|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"\b[0-9a-fA-F]{32,}\b"),
    re.compile(r"\bBearer\s+[\w.~+/-]+"),
    re.compile(r"-----BEGIN [A-Z ]*-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\beyJ[\w-]{10,}\.[\w-]{10,}"),
    re.compile(r"\b[A-Za-z0-9+/]{40,}={0,2}(?![\w+/=])"),
]
LOCAL_PATH = re.compile(r"(?:^|[\s(`\"'])(?:/home/|/Users/|~/|[A-Za-z]:\\Users\\)")
TOOL = re.compile(r"\b(?:co-authored-by|generated (?:with|by)|claude|copilot|chatgpt)\b", re.IGNORECASE)
TITLE_PREFIX = re.compile(r"^\s*(?:merged?\s+PR\b|merge\b)", re.IGNORECASE)
TITLE_WIP = re.compile(r"\b(?:WIP|fixup|squash!|TODO|FIXME|XXX)\b|review (?:comments|feedback)|address(?:ed|es)? (?:pr|review)", re.IGNORECASE)


@dataclass(frozen=True)
class Finding:
    line: int
    level: str  # "error" or "warning"
    code: str
    message: str


def host_allowed(host: str, allowed: list[str]) -> bool:
    host = host.lower().rstrip(".")
    return any(host == a or host.endswith("." + a) for a in allowed)


def check(text: str, denylist: list[str], allowed_hosts: list[str]) -> list[Finding]:
    """All findings for a message: first line = title, a blank line, then the description."""
    lines = text.splitlines()
    out: list[Finding] = []

    def add(n: int, level: str, code: str, message: str) -> None:
        out.append(Finding(n, level, code, message))

    title = lines[0] if lines else ""
    if not title.strip():
        add(1, "error", "title-empty", "the first line is the title and must not be empty")
    else:
        if len(title) > TITLE_MAX:
            add(1, "error", "title-length", f"title has {len(title)} characters, at most {TITLE_MAX}")
        if not title[0].isupper():
            add(1, "error", "title-case", "title starts with a capital letter")
        if title.rstrip().endswith((".", "…")):
            add(1, "error", "title-period", "title has no full stop at the end")
        if TITLE_PREFIX.search(title):
            add(1, "error", "title-prefix", "no host prefix such as 'Merged PR 123:' and no 'Merge …': the title says what changes")
        if TITLE_WIP.search(title):
            add(1, "error", "title-wip", "title is not a work-in-progress or review note (WIP, fixup, TODO, 'address review')")
        if re.search(r"[^\x00-\x7f]", title):
            add(1, "warning", "title-english", "title has non-ASCII characters: is it English?")
    if len(lines) > 1 and lines[1].strip():
        add(2, "error", "blank-line", "the second line must be blank (title, blank line, description)")
    body_lines = sum(1 for l in lines[1:] if l.strip())
    if body_lines > BODY_MAX_LINES:
        add(2, "error", "body-length", f"description has {body_lines} lines, at most {BODY_MAX_LINES}: keep it short, the diff says the rest")

    for number, line in enumerate(lines, start=1):
        if number > 1 and len(line) > WRAP and " " in line.strip():
            add(number, "error", "wrap", f"line has {len(line)} characters, wrap at {WRAP}")
        hosts_seen: set[str] = set()
        for url in URL.findall(line):
            host = urlparse(url).hostname or ""
            hosts_seen.add(host.lower())
            if not host_allowed(host, allowed_hosts):
                add(number, "error", "url", "a URL: only hosts given with --allow-host may appear")
        for host in HOST.findall(line):
            if host.lower() not in hosts_seen and host.lower() not in NOT_A_HOST and not host_allowed(host, allowed_hosts):
                add(number, "error", "host", "a host name: only hosts given with --allow-host may appear")
        if EMAIL.search(line):
            add(number, "error", "email", "an e-mail address")
        if IPV4.search(line):
            add(number, "error", "ip", "an IP address")
        if MENTION.search(re.sub(r"`[^`]*`", "", line)):
            add(number, "error", "mention", "an @mention notifies or names a person")
        if any(p.search(line) for p in REF) or any(m.group(1) not in NOT_A_KEY for m in KEY.finditer(line)):
            add(number, "error", "ref", "a number or key of a tracker, work item or pull request: it means nothing outside")
        if any(p.search(line) for p in SECRET):
            add(number, "error", "secret", "looks like a secret, token or key (the value is not shown)")
        if LOCAL_PATH.search(line):
            add(number, "error", "path", "a path on somebody's machine")
        if TOOL.search(line):
            add(number, "error", "tool", "no mention of AI tools and no trailers that name them")
        lowered = line.lower()
        for term in denylist:
            if term.lower() in lowered:
                add(number, "error", "denylist", f"contains the internal term '{term}'")
    return out


def scan(text: str, denylist: list[str]) -> list[Finding]:
    """Only the denylist, for any text file."""
    out = []
    for number, line in enumerate(text.splitlines(), start=1):
        lowered = line.lower()
        out.extend(Finding(number, "error", "denylist", f"contains the internal term '{t}'") for t in denylist if t.lower() in lowered)
    return out


def read_denylist(path: str | None) -> list[str] | None:
    """The terms of the denylist file, without blank lines and `#` comments; None without a path (internal names then stay unchecked). Exits if the file is missing."""
    if not path:
        return None
    file = Path(path)
    if not file.is_file():
        sys.exit(f"denylist not found: {file}")
    terms = [l.strip() for l in file.read_text(encoding="utf-8").splitlines()]
    return [t for t in terms if t and not t.startswith("#")]


# Each case: a name, a text, and the error codes it must produce (set() = a clean message with no warning either).
GOOD = "Add region-aware cart prices\n\nThe cart now shows the price of the visitor's region.\nPrices come from the product record, one value per market.\n"
CASES = [
    ("good", GOOD, set()),
    ("title-prefix", "Merged PR 12: Add cart prices\n\nBody.\n", {"title-prefix"}),
    ("title-length", "A" * 61 + "\n\nBody.\n", {"title-length"}),
    ("body-length", "Add cart prices\n\nOne.\nTwo.\nThree.\nFour.\n", {"body-length"}),
    ("wrap", "Add cart prices\n\n" + "word " * 15 + "\n", {"wrap"}),
    ("title only", "Add cart prices\n", set()),
    ("title-case", "add cart prices\n\nBody.\n", {"title-case"}),
    ("title-period", "Add cart prices.\n\nBody.\n", {"title-period"}),
    ("title-wip", "WIP add cart prices\n\nBody.\n", {"title-wip"}),
    ("blank-line", "Add cart prices\nBody without a blank line.\n", {"blank-line"}),
    ("url", "Add cart prices\n\nSee https://corp-internal.example/wiki/page for details.\n", {"url"}),
    ("host", "Add cart prices\n\nRuns on build.corp-internal.example.\n", {"host"}),
    ("email", "Add cart prices\n\nAsk user@example.org about it.\n", {"email"}),
    ("ip", "Add cart prices\n\nThe service answers on 10.0.0.12.\n", {"ip"}),
    ("mention", "Add cart prices\n\nThanks to @someone for the idea.\n", {"mention"}),
    ("ref-number", "Add cart prices\n\nFixes #123.\n", {"ref"}),
    ("ref-key", "Add cart prices\n\nRelates to PROJ-123.\n", {"ref"}),
    ("ref-pr", "Add cart prices\n\nFollow-up of PR 12.\n", {"ref"}),
    ("secret-pair", "Add cart prices\n\nUse password: hunter2 to log in.\n", {"secret"}),
    ("secret-hex", "Add cart prices\n\nThe key is " + "0123456789abcdef" * 2 + ".\n", {"secret"}),
    ("path", "Add cart prices\n\nCopied from /home/someone/work/notes.\n", {"path"}),
    ("tool", "Add cart prices\n\nCo-Authored-By: Some Tool <noreply@example.org>\n", {"tool"}),
]


def self_test() -> int:
    failed = 0
    for name, text, expected in CASES:
        found = check(text, [], [])
        codes = {f.code for f in found if f.level == "error"}
        ok = (not found) if name in ("good", "title only") else expected <= codes
        failed += not ok
        print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  expected {sorted(expected)}, got {sorted(f.code for f in found)}"))
    extra = [
        ("denylist", check("Add cart prices\n\nRuns on corp-internal-registry.\n", ["Corp-Internal"], []), True),
        ("denylist off", check(GOOD, ["corp-internal"], []), False),
        ("allowed host", check("Add cart prices\n\nSee https://docs.example.org/page.\n", [], ["example.org"]), False),
        ("not a key", check("Add cart prices\n\nWrite the files as UTF-8.\n", [], []), False),
        ("not a host", check("Add the demo with ASP.NET Core Razor Pages\n", [], []), False),
        ("code span mention", check("Add cart prices\n\nTests tagged `@tag` are left out.\n", [], []), False),
    ]
    for name, found, must_fail in extra:
        ok = any(f.level == "error" for f in found) == must_fail
        failed += not ok
        print(("ok   " if ok else "FAIL ") + name)
    print("self-test " + ("passed" if not failed else f"FAILED: {failed}"))
    return 1 if failed else 0


def report(label: str, findings: list[Finding]) -> int:
    for f in findings:
        print(f"{label}{f.level:<7} line {f.line} [{f.code}] {f.message}")
    return sum(f.level == "error" for f in findings)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check a squash-merge title and description before the pull request is created, changed or completed.")
    parser.add_argument("files", nargs="*", help="message file ('-' = stdin); with --scan: any files")
    parser.add_argument("--denylist", help="file with internal terms, one per line (default: $PR_TEXT_DENYLIST)")
    parser.add_argument("--allow-host", action="append", default=[], help="a host that may appear (also its subdomains); repeatable")
    parser.add_argument("--scan", action="store_true", help="check only the denylist, in any files")
    parser.add_argument("--self-test", action="store_true", help="run the built-in cases")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.files:
        parser.error("give a message file, '-' for stdin, or --self-test")
    denylist = read_denylist(args.denylist or os.environ.get("PR_TEXT_DENYLIST"))
    if args.scan:
        if denylist is None:
            parser.error("--scan needs a denylist (--denylist or $PR_TEXT_DENYLIST)")
        errors = sum(report(f"{p}: ", scan(Path(p).read_text(encoding="utf-8"), denylist)) for p in args.files)
    else:
        if len(args.files) != 1:
            parser.error("give exactly one message file")
        source = args.files[0]
        text = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
        errors = report("", check(text, denylist or [], [h.lower() for h in args.allow_host]))
    if denylist is None:
        print("note: no denylist, so names of internal systems are not checked (--denylist or $PR_TEXT_DENYLIST)")
    print("check failed" if errors else "check passed")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
