"""Offline tests against the pinned OpenAPI snapshot and a synthetic fixture."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from oriane_probe.capabilities import capability_report
from oriane_probe.gate import interpret_contents_gate, load_routes_gate
from oriane_probe.ideas import assert_citations
from oriane_probe.interpret import channel_report, page_plan
from oriane_probe.query import (
    LiveCallBlocked,
    QueryError,
    beside_caption_page,
    content_by_id,
    creator_content_search,
    creator_profile_search,
    execute,
    text_asset_request,
    untagged_phrase_search,
    visual_search_request,
)
from oriane_probe.snapshot import ROOT, load_provenance, load_snapshot, snapshot_sha256

FIXTURE = json.loads((ROOT / "fixtures" / "synthetic_content_full.json").read_text())


class SnapshotTests(unittest.TestCase):
    def test_provenance_hash_matches_snapshot(self) -> None:
        self.assertEqual(snapshot_sha256(), load_provenance()["sha256"])
        self.assertFalse(load_provenance()["live_authenticated_calls"])

    def test_document_shape(self) -> None:
        report = capability_report()
        self.assertEqual(report["paths"], ["/rest/assets", "/rest/contents/search", "/rest/profiles/search"])
        self.assertEqual(report["component_keys"], ["schemas"])
        self.assertIsNone(report["securitySchemes"])
        self.assertIsNone(report["root_security"])
        self.assertIsNone(report["documented_auth_header"])
        self.assertTrue(report["api_key_link_present_in_info"])
        self.assertEqual(report["content_query"]["limit_max"], 100)
        self.assertEqual(report["platforms"], ["instagram", "tiktok", "youtube"])
        self.assertIn("frames", report["media_fields"]["full_only"])
        self.assertIn("transcriptChunks", report["media_fields"]["full_only"])
        self.assertNotIn("frames", report["media_fields"]["default_not_in_basic"])
        self.assertIn("transcript", report["media_fields"]["default_not_in_basic"])
        self.assertIn("onScreenText", report["media_fields"]["default_not_in_basic"])
        self.assertEqual(report["absent_property_names_found"], [])
        self.assertEqual(report["description_word_counts"]["brand"], 0)
        self.assertEqual(report["description_word_counts"]["paid"], 0)
        self.assertFalse(report["who_owes_you"]["structured_brand_property"])
        self.assertFalse(report["who_owes_you"]["paid_or_disclosure_property"])
        self.assertFalse(report["who_owes_you"]["canonical_post_url_property"])
        self.assertTrue(report["who_owes_you"]["creator_handle_filter"])
        self.assertTrue(report["who_owes_you"]["viewsCount_nullable"])
        self.assertIsNone(report["frames"]["visualSimilarityScore_description"])
        self.assertIn("not processed", report["on_screen_text_description"])
        self.assertIsNone(report["transcript_description"])
        self.assertIn("matched contents", report["aggregations"]["content_scope_language"])
        for operation in report["operations"].values():
            self.assertIsNone(operation["security"])

    def test_idea_citations_resolve(self) -> None:
        cited = assert_citations(load_snapshot())
        self.assertIn("SearchContentsResponse.FullMedia.Body.frames", cited)
        self.assertIn("SearchContentsRequest.Filters.Body.visualSimilarity", cited)


class QueryTests(unittest.TestCase):
    def test_creator_enumeration_request(self) -> None:
        prepared = creator_content_search("@Synthetic.Probe")
        self.assertEqual(prepared["method"], "POST")
        self.assertTrue(prepared["url"].startswith("https://connect.oriane.xyz/rest/contents/search?"))
        self.assertEqual(prepared["query"]["projection"], "full")
        self.assertEqual(prepared["query"]["limit"], 100)
        self.assertEqual(prepared["query"]["sort"], "publishedAt:desc")
        self.assertNotIn("aiSearchAnchor", prepared["query"])
        self.assertIsNone(prepared["auth_header"])
        self.assertNotIn("Authorization", prepared["headers"])
        filters = prepared["body"]["filters"]
        self.assertEqual(
            filters["profileHandle"]["exactMatch"],
            {"values": ["Synthetic.Probe"], "operator": "or"},
        )
        self.assertEqual(filters["platform"]["includes"], ["instagram", "tiktok"])

    def test_rejects_undocumented_paging_and_platform(self) -> None:
        with self.assertRaises(QueryError):
            creator_content_search("someone", limit=101)
        with self.assertRaises(QueryError):
            creator_content_search("someone", platforms=["vine"])

    def test_demo_page_is_small_and_default_projection(self) -> None:
        prepared = beside_caption_page("someone")
        self.assertEqual(prepared["query"]["projection"], "default")
        self.assertEqual(prepared["query"]["limit"], 5)
        self.assertEqual(prepared["query"]["sort"], "viewsCount:desc")

    def test_content_by_id_and_profile_and_untagged(self) -> None:
        by_id = content_by_id("cnt_SYNTHETICPLUMBINGONLY0000001")
        self.assertEqual(by_id["query"]["projection"], "full")
        self.assertEqual(by_id["body"]["filters"]["id"]["includes"], ["cnt_SYNTHETICPLUMBINGONLY0000001"])
        profile = creator_profile_search("someone")
        self.assertIn("/rest/profiles/search", profile["url"])
        self.assertEqual(profile["body"]["filters"]["handle"]["exactMatch"]["values"], ["someone"])
        untagged = untagged_phrase_search("someone", "silverpool")
        filters = untagged["body"]["filters"]
        self.assertEqual(filters["transcript"]["includesExactly"]["values"], ["silverpool"])
        self.assertEqual(filters["profileHandle"]["excludesExactly"]["values"], ["someone"])
        self.assertEqual(filters["mentionHandles"]["excludesExactly"]["values"], ["someone"])

    def test_asset_and_visual_search_need_an_id_before_similarity(self) -> None:
        asset = text_asset_request("a bottle on a bathroom shelf")
        self.assertEqual(asset["path"], "/rest/assets")
        self.assertEqual(asset["body"]["type"], "text")
        with self.assertRaises(QueryError):
            text_asset_request("x" * 301)
        visual = visual_search_request("ast_SYNTHETICPLUMBINGONLY0000001")
        value = visual["body"]["filters"]["visualSimilarity"]["includes"]["values"][0]
        self.assertEqual(value["assetId"], "ast_SYNTHETICPLUMBINGONLY0000001")
        self.assertEqual(visual["query"]["sort"], "visualSimilarity:desc")
        self.assertIn("aiSearchAnchor", visual["note"])

    def test_execute_never_sends(self) -> None:
        with self.assertRaises(LiveCallBlocked):
            execute(creator_content_search("someone"), api_key="not-a-real-key", auth_header_name="Authorization", confirm_spend=True)


class InterpretTests(unittest.TestCase):
    def test_synthetic_fixture_is_labeled_and_finds_the_caption_gap(self) -> None:
        self.assertIn("SYNTHETIC", FIXTURE["_fixture"])
        report = channel_report(FIXTURE)
        self.assertEqual(report["source_label"], "synthetic_fixture")
        self.assertFalse(report["live_oriane_response"])
        self.assertEqual(report["payment_status"], "not_in_schema_creator_must_confirm")
        self.assertEqual(report["brand_properties_read"], [])
        self.assertEqual(report["illustrative_media_value"], "not_computed")
        self.assertIsNone(report["permalink"]["url"])
        self.assertNotIn("tiktok.com", json.dumps(report["permalink"]))
        self.assertIn("silverpool", report["spoken_and_on_screen_not_caption"])
        self.assertNotIn("silverpool", report["channels"]["caption_and_hashtags"]["tokens"])
        self.assertIn("dawnlabel", report["only_on_screen"])
        self.assertIn("link", report["only_caption"])
        self.assertFalse(report["vision_executed"])
        hero = report["chunk_frames"][1]
        self.assertIn("silverpool", hero["text"])
        self.assertEqual(hero["alignment"], "overlaps")
        self.assertTrue(hero["frame"]["url"].endswith("frame-4.8.webp"))
        self.assertIsNone(hero["frame"]["brand_label"])
        self.assertEqual(report["chunk_frames"][0]["alignment"], "overlaps")
        self.assertTrue(report["chunk_frames"][0]["frame"]["url"].endswith("frame-0.5.webp"))

    def test_missing_transcript_is_not_a_negative_proof(self) -> None:
        report = channel_report(
            {
                "caption": "hello there friend",
                "media": [{"transcript": None, "transcriptChunks": None, "onScreenText": None, "frames": []}],
            }
        )
        self.assertFalse(report["channels"]["transcript"]["timestamps_present"])
        self.assertEqual(report["channels"]["on_screen_text"]["state"], "null_not_processed")
        self.assertIn("not proof", report["transcript_absence"])
        self.assertEqual(report["chunk_frames"], [])

    def test_page_plan_does_not_invent_a_price(self) -> None:
        plan = page_plan(250, 100)
        self.assertEqual(plan["search_calls_for_full_enumeration"], 3)
        self.assertIsNone(plan["oriane_credit_price"])


class GateTests(unittest.TestCase):
    def test_recorded_keyless_calls_are_not_content_proof(self) -> None:
        interpreted = interpret_contents_gate()
        self.assertEqual(interpreted["http_status"], 401)
        self.assertEqual(interpreted["operation"], "AUTHENTICATION")
        self.assertEqual(interpreted["code"], "UNAUTHORIZED")
        self.assertFalse(interpreted["auth_header_name_disclosed"])
        self.assertFalse(interpreted["creator_results_present"])
        self.assertFalse(interpreted["query_shape_server_validated"])
        self.assertFalse(interpreted["live_content_proof"])
        routes = load_routes_gate()
        self.assertFalse(routes["live_content_proof"])
        self.assertEqual(
            [route["path"] for route in routes["routes"]],
            ["/rest/contents/search", "/rest/profiles/search", "/rest/assets"],
        )
        for route in routes["routes"]:
            self.assertEqual(route["http_status"], 401)
            self.assertIsNone(route["www_authenticate"])
            self.assertEqual(route["error"]["code"], "UNAUTHORIZED")


if __name__ == "__main__":
    unittest.main()
