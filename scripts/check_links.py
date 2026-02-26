#!/usr/bin/env python3
"""Validate local links and in-page anchors for static HTML files."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
import re
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = sorted(REPO_ROOT.glob('*.html'))

URL_ATTRS = ('href', 'src', 'poster')
SKIP_PREFIXES = ('http://', 'https://', 'mailto:', 'tel:', 'javascript:', 'data:')


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[tuple[str, int, str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        line, _ = self.getpos()

        element_id = attrs_dict.get('id')
        if element_id:
            self.ids.add(element_id)

        for attr in URL_ATTRS:
            value = attrs_dict.get(attr)
            if value:
                self.references.append((tag, line, attr, value))


def check_html_file(html_file: Path) -> list[str]:
    parser = LinkParser()
    parser.feed(html_file.read_text(encoding='utf-8'))

    issues: list[str] = []
    for tag, line, attr, raw_value in parser.references:
        if raw_value.startswith(SKIP_PREFIXES):
            continue

        if raw_value.startswith('#'):
            anchor = raw_value[1:]
            if anchor and anchor not in parser.ids:
                issues.append(f"{html_file.name}:{line} {tag}[{attr}] -> '{raw_value}' (missing target id)")
            continue

        relative_path = raw_value.split('#', 1)[0].split('?', 1)[0]
        resolved = (html_file.parent / unquote(relative_path)).resolve()
        if not resolved.exists():
            repo_relative = resolved.relative_to(REPO_ROOT) if resolved.is_relative_to(REPO_ROOT) else resolved
            issues.append(
                f"{html_file.name}:{line} {tag}[{attr}] -> '{raw_value}' (missing file: {repo_relative})"
            )

    return issues


def main() -> int:
    if not HTML_FILES:
        print('No HTML files found.')
        return 0

    all_issues: list[str] = []
    for html_file in HTML_FILES:
        all_issues.extend(check_html_file(html_file))

    if all_issues:
        print('Invalid links detected:')
        for issue in all_issues:
            print(f' - {issue}')
        return 1

    scanned = ', '.join(file.name for file in HTML_FILES)
    print(f'All local links are valid. Files scanned: {scanned}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
