"""Print the schema report. Does not call Oriane."""

from __future__ import annotations

import json

from oriane_probe.capabilities import capability_report
from oriane_probe.gate import interpret_contents_gate, load_routes_gate
from oriane_probe.ideas import ALTERNATIVES, REJECTED_STANDALONE
from oriane_probe.snapshot import ROOT

def main() -> None:
    report = capability_report()
    gate = interpret_contents_gate()
    routes = load_routes_gate()
    out = {
        "who_owes_you_build": False,
        "live_creator_results": False,
        "auth_header_name_disclosed": gate["auth_header_name_disclosed"],
        "gate": gate,
        "routes": [
            {"path": route["path"], "http_status": route["http_status"]}
            for route in routes["routes"]
        ],
        "media_fields": report["media_fields"],
        "absent_property_names_found": report["absent_property_names_found"],
        "description_word_counts": report["description_word_counts"],
        "recommended": next(idea["slug"] for idea in ALTERNATIVES if idea["recommended"]),
        "alternatives": [
            {"rank": idea["rank"], "slug": idea["slug"], "title": idea["title"]}
            for idea in ALTERNATIVES
        ],
        "rejected_standalone": [item["slug"] for item in REJECTED_STANDALONE],
    }
    destination = ROOT / "evidence" / "capability-report.json"
    destination.write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))
    print(f"\nWrote {destination}")


if __name__ == "__main__":
    main()
