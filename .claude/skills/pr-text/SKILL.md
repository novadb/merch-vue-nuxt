---
name: pr-text
description: Writes and checks the title and description of a pull request that will be squash-merged into main, because together they become the one public commit message. Use before creating, changing or completing such a pull request, and whenever the text of a commit that reaches main is written.
---

# Title and description of a pull request

`main` is public and keeps one commit per pull request. That commit's message is the pull request's title and
description, read for years by customers and developers who know nothing about how this team works. Write it for them.
It cannot be rewritten afterwards: `main` accepts no force push.

## What a good text is

- **English.** The title is one line of at most 60 characters, in the imperative, starting with a capital letter, without a
  full stop: `Add region-aware cart prices`. It says what changes, not what was done to the branch.
- **The description** is optional. If there is one, it follows after a blank line: what changes for users or developers and
  why, in at most three lines of at most 72 characters. A pull request that needs more is too big or says too much.
- **Neutral and factual.** No irony, no blame, no internal jokes, no apology, no "as discussed", no "WIP", no "address
  review comments". Read it as a stranger would.
- **Security fixes** are described by what the code does now (`Escape user input in search results`), never by how the
  old code could be abused, and not before the fix is released.

## What never goes in

- Credentials, tokens, keys, passwords, connection strings. A key that is public by design does not belong either.
- Host names, URLs, IP addresses, and the names of internal systems: servers, clusters, registries, tenants, installations,
  pipelines, variable groups, accounts, branches or identifiers of a data source that is not public.
- Numbers or keys of trackers, work items or pull requests, and any prefix or number the hosting service adds. They mean
  nothing outside, and they reveal how the team is organised.
- People other than the author line of the commit; customers and customer data; unreleased plans, prices, strategy.
- Paths on somebody's machine.
- Mentions of AI tools and the commit trailers that name them.

When in doubt, leave it out: the diff and the code say the rest.

## Procedure

1. Write the text into a file outside the repository (a scratch folder): title, blank line, description.
2. Run `uv run scripts/check-pr-text.py <file>` and fix every error. The check knows the patterns above. It also reads a list of
   concrete internal terms if the maintainers provide one (`--denylist` or `PR_TEXT_DENYLIST`); without it, the output says that
   names of internal systems were not checked, so read the text for them yourself.
3. Show the final text to the user and wait for their approval before the pull request is created or changed.
4. Create or change the pull request with exactly this title and description, and set the merge commit message of the
   completion to the same text (title, blank line, description). Never complete with the host's default message: it adds a
   prefix and numbers of its own.
5. After the merge, read `git log -1 --format=%B origin/main` and compare it with the approved text.

## Examples

Good:

```
Add region-aware cart prices

The cart shows the price of the visitor's region instead of the default
market. Prices still come from the product record, one value per market.
```

```
Fix a 500 on product paths that end in a backslash

The path is now rejected as not found. The cache of upstream answers has
a size limit, so long-running servers stop growing.
```

Bad, each for one reason:

```
Merged PR 4711: wip cart stuff            <- host prefix and number, WIP, says nothing
```

```
Fix login on build.corp-internal.example (PROJ-123)   <- internal host, tracker key
```

```
Update README                              <- what changes, and why?

Co-Authored-By: Some Tool <noreply@example.org>      <- names an AI tool
```
