"""CLI for a captured creator contents-search file. Does not open a socket."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from creator_discovery.report import analyze, dump_report, render_findings, render_text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Read a captured creator contents search and write evidence. Does not call Oriane or GMI."
    )
    parser.add_argument("--capture", action="append", required=True, help="Captured JSON. Repeatable.")
    parser.add_argument("--names", help="JSON list, or an object with names, of strings to quote-check. Not a brand gazetteer.")
    parser.add_argument("--confirm", help="JSON object {\"names\": [\"...\"]} of candidates a person has confirmed.")
    parser.add_argument("--out", help="Directory for report.json, report.txt, and experiments.json.")
    parser.add_argument("--findings", help="Path for a markdown findings note generated from the report.")
    args = parser.parse_args(argv)
    names = _names(args.names) if args.names else []
    confirmed = _confirmed(args.confirm) if args.confirm else set()
    report = analyze(args.capture, illustrative_names=names, confirmed_names=confirmed)
    text = render_text(report)
    if args.out:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        (out / "report.json").write_text(dump_report(report), encoding="utf-8")
        (out / "report.txt").write_text(text, encoding="utf-8")
        (out / "experiments.json").write_text(
            json.dumps(report["experiments"], indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    if args.findings:
        Path(args.findings).write_text(render_findings(report), encoding="utf-8")
    sys.stdout.write(text)
    return 0


def _names(path: str) -> list[str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    values = payload["names"] if isinstance(payload, dict) else payload
    if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
        raise SystemExit("--names must be a list of strings.")
    return values


def _confirmed(path: str) -> set[str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    values = payload.get("names") if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        raise SystemExit("--confirm must be an object with a names list.")
    return {item for item in values if isinstance(item, str)}


if __name__ == "__main__":
    raise SystemExit(main())
