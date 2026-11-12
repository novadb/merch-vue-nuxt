# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Checks the pull request that a build validation run belongs to, before it can be merged into main.

- The source branch is `feature/<work item id>-<slug>` or `bugfix/<work item id>-<slug>`.
- That work item is linked to the pull request.
- The merge commit message is set and equals the title, a blank line and the description: the host would otherwise add
  a prefix and numbers of its own to the one public commit.
- That message passes scripts/check-pr-text.py (and the denylist of internal terms, if one is given).

Usage (in the pipeline; no dependencies, so plain python3 is enough):
  python3 scripts/check-pull-request.py [--denylist terms.txt]
It reads the pull request through the REST API with the run's access token, from the variables the host sets in the
environment: SYSTEM_ACCESSTOKEN (map it explicitly), SYSTEM_COLLECTIONURI, SYSTEM_TEAMPROJECT, BUILD_REPOSITORY_ID and
SYSTEM_PULLREQUEST_PULLREQUESTID. Exit code 1 on findings, 2 on a usage or environment error.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True  # importing check-pr-text must leave no __pycache__ in a checkout

BRANCH = re.compile(r"^refs/heads/(?:feature|bugfix)/(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$")


def need(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"{name} is not set: this runs only in a pull request build, with the access token mapped to SYSTEM_ACCESSTOKEN")
    return value


def get(url: str, token: str) -> dict:
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.URLError as error:
        sys.exit(f"cannot read {url.split('?')[0]}: {error}")


def load_checker():
    path = Path(__file__).resolve().parent / "check-pr-text.py"
    spec = importlib.util.spec_from_file_location("check_pr_text", path)
    if spec is None or spec.loader is None:
        sys.exit(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalise(text: str) -> str:
    return text.replace("\r\n", "\n").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--denylist", help="file with internal terms, one per line (default: $PR_TEXT_DENYLIST)")
    args = parser.parse_args()

    token = need("SYSTEM_ACCESSTOKEN")
    project = urllib.parse.quote(need("SYSTEM_TEAMPROJECT"))
    pull = f"{need('SYSTEM_COLLECTIONURI')}{project}/_apis/git/repositories/{need('BUILD_REPOSITORY_ID')}/pullRequests/{need('SYSTEM_PULLREQUEST_PULLREQUESTID')}"
    request = get(f"{pull}?api-version=7.1", token)
    linked = {int(item["id"]) for item in get(f"{pull}/workitems?api-version=7.1", token)["value"]}

    findings: list[str] = []

    match = BRANCH.match(request["sourceRefName"])
    if not match:
        findings.append(f"branch '{request['sourceRefName'].removeprefix('refs/heads/')}': name it feature/<work item id>-<slug> or bugfix/<work item id>-<slug>")
    elif int(match.group(1)) not in linked:
        findings.append(f"work item {match.group(1)}, named by the branch, is not linked to the pull request")

    title = request["title"].strip()
    description = (request.get("description") or "").strip()
    expected = normalise(title + ("\n\n" + description if description else ""))
    actual = normalise((request.get("completionOptions") or {}).get("mergeCommitMessage") or "")
    if not actual:
        findings.append("the merge commit message is not set: set it to the title, a blank line and the description")
    elif actual != expected:
        findings.append("the merge commit message differs from title and description: set it to exactly that text")

    checker = load_checker()
    denylist = checker.read_denylist(args.denylist or os.environ.get("PR_TEXT_DENYLIST"))
    if denylist is None:
        print("note: no denylist, so names of internal systems are not checked")
    findings += [f"text line {f.line} [{f.code}] {f.message}" for f in checker.check(expected + "\n", denylist or [], []) if f.level == "error"]

    for finding in findings:
        print(f"error: {finding}")
    print("pull request check failed" if findings else "pull request check passed")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
