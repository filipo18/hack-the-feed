"""Facts read from the pinned OpenAPI document, plus separately labeled non-schema sources."""

from __future__ import annotations

import re

from oriane_probe.snapshot import load_provenance, load_snapshot, schema, snapshot_sha256

ABSENT_PROPERTY_NAMES = (
    "postUrl",
    "videoUrl",
    "permalink",
    "shareUrl",
    "contentUrl",
    "brand",
    "brands",
    "logo",
    "logos",
    "paidPartnership",
    "isSponsored",
    "isAd",
    "commercialDisclosure",
    "sponsorship",
    "adDisclosure",
)


def capability_report(spec: dict | None = None) -> dict:
    spec = spec or load_snapshot()
    names = _property_names(spec)
    operations = {
        path: {
            "method": "post",
            "operationId": spec["paths"][path]["post"].get("operationId"),
            "security": spec["paths"][path]["post"].get("security"),
            "responses": sorted(spec["paths"][path]["post"]["responses"]),
            "response_descriptions": {
                code: spec["paths"][path]["post"]["responses"][code].get("description", "")
                for code in spec["paths"][path]["post"]["responses"]
            },
        }
        for path in spec["paths"]
    }
    content_params = {
        parameter["name"]: parameter
        for parameter in spec["paths"]["/rest/contents/search"]["post"]["parameters"]
    }
    found = {name for name in ABSENT_PROPERTY_NAMES if name in names}
    return {
        "evidence_class": "pinned_openapi_snapshot",
        "openapi": spec["openapi"],
        "info_version": spec["info"]["version"],
        "server": spec["servers"][0]["url"],
        "sha256": snapshot_sha256(),
        "provenance": load_provenance(),
        "paths": sorted(spec["paths"]),
        "component_keys": sorted(spec["components"]),
        "securitySchemes": spec["components"].get("securitySchemes"),
        "root_security": spec.get("security"),
        "operations": operations,
        "api_key_link_present_in_info": "https://app.oriane.xyz/billing/subscription?tab=api"
        in spec["info"].get("description", ""),
        "documented_auth_header": None,
        "content_query": {
            "limit_min": content_params["limit"]["schema"]["minimum"],
            "limit_max": content_params["limit"]["schema"]["maximum"],
            "offset_min": content_params["offset"]["schema"]["minimum"],
            "projections": content_params["projection"]["schema"]["enum"],
            "aiSearchAnchor": content_params["aiSearchAnchor"]["description"],
        },
        "platforms": schema(spec, "SearchContentsResponse.FullResult.Body")["properties"]["platform"]["enum"],
        "media_fields": _field_delta(
            spec,
            "SearchContentsResponse.FullMedia.Body",
            "SearchContentsResponse.DefaultMedia.Body",
            "SearchContentsResponse.BasicMedia.Body",
        ),
        "result_fields": _field_delta(
            spec,
            "SearchContentsResponse.FullResult.Body",
            "SearchContentsResponse.DefaultResult.Body",
            "SearchContentsResponse.BasicResult.Body",
        ),
        "content_filter_names": sorted(schema(spec, "SearchContentsRequest.Filters.Body")["properties"]),
        "profile_filter_names": sorted(schema(spec, "SearchProfilesRequest.Filters.Body")["properties"]),
        "aggregations": {
            "content_full_and_default_schema": "SearchContentsResponse.DefaultAggregation.Body",
            "content_scope_language": schema(spec, "SearchContentsResponse.DefaultAggregation.Body")["properties"][
                "totalViewsCount"
            ]["description"],
            "fields": sorted(schema(spec, "SearchContentsResponse.DefaultAggregation.Body")["properties"]),
        },
        "frames": {
            "required": schema(spec, "SearchContentsResponse.Frame.Body")["required"],
            "properties": sorted(schema(spec, "SearchContentsResponse.Frame.Body")["properties"]),
            "visualSimilarityScore_description": schema(spec, "SearchContentsResponse.Frame.Body")["properties"][
                "visualSimilarityScore"
            ].get("description"),
        },
        "on_screen_text_description": schema(spec, "SearchContentsResponse.FullMedia.Body")["properties"][
            "onScreenText"
        ].get("description"),
        "transcript_description": schema(spec, "SearchContentsResponse.FullMedia.Body")["properties"]["transcript"].get(
            "description"
        ),
        "visual_similarity_description": schema(spec, "SearchContentsRequest.Filters.Body")["properties"][
            "visualSimilarity"
        ]["description"],
        "absent_property_names_found": sorted(found),
        "description_word_counts": {
            word: len(re.findall(rf"\b{word}\b", _description_blob(spec), flags=re.IGNORECASE))
            for word in ("brand", "sponsor", "paid", "disclosure", "permalink", "postUrl")
        },
        "who_owes_you": {
            "creator_handle_filter": "profileHandle"
            in schema(spec, "SearchContentsRequest.Filters.Body")["properties"],
            "viewsCount_on_basic_result": "viewsCount"
            in schema(spec, "SearchContentsResponse.BasicResult.Body")["properties"],
            "viewsCount_nullable": schema(spec, "SearchContentsResponse.BasicResult.Body")["properties"]["viewsCount"][
                "nullable"
            ],
            "structured_brand_property": bool(found & {"brand", "brands", "logo", "logos"}),
            "paid_or_disclosure_property": bool(
                found
                & {
                    "paidPartnership",
                    "isSponsored",
                    "isAd",
                    "commercialDisclosure",
                    "sponsorship",
                    "adDisclosure",
                }
            ),
            "canonical_post_url_property": bool(
                found & {"postUrl", "videoUrl", "permalink", "shareUrl", "contentUrl"}
            ),
            "live_creator_results": False,
        },
        "non_schema_sources": {
            "product_help": {
                "evidence_class": "product_help_page",
                "url": "https://www.oriane.xyz/how-to-search",
                "read_on": "2026-11-06",
                "claims": [
                    "The search UI data window is the last 3 months.",
                    "Videos from accounts with fewer than 5,000 followers are not indexed.",
                    "New videos can take up to one week to index.",
                    "CSV export columns include Video Code and Video URL.",
                    "CSV export is capped at 10,000 rows.",
                ],
                "not_restated_as_openapi_rules": True,
            },
            "pricing_page": {
                "evidence_class": "marketing_page",
                "url": "https://www.oriane.xyz/pricing",
                "read_on": "2026-11-06",
                "claim": "Credits are consumed per call and content search cost depends on projection.",
                "numeric_table_in_static_html": False,
            },
            "marketing_mcp": {
                "evidence_class": "marketing_page",
                "url": "https://www.oriane.xyz/",
                "claim": "The homepage says data can be pulled through an API or plugged into agents via MCP.",
                "mcp_in_openapi": False,
                "mcp_server_url_in_fetched_docs": False,
            },
        },
    }


def _field_delta(spec: dict, full_name: str, default_name: str, basic_name: str) -> dict:
    full = set(schema(spec, full_name)["properties"])
    default = set(schema(spec, default_name)["properties"])
    basic = set(schema(spec, basic_name)["properties"])
    return {
        "full_only": sorted(full - default),
        "default_not_in_basic": sorted(default - basic),
        "basic": sorted(basic),
    }


def _property_names(spec: dict) -> set[str]:
    names: set[str] = set()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            properties = node.get("properties")
            if isinstance(properties, dict):
                names.update(properties)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(spec["components"]["schemas"])
    return names


def _description_blob(spec: dict) -> str:
    chunks: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            description = node.get("description")
            if isinstance(description, str):
                chunks.append(description)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(spec)
    return "\n".join(chunks)
