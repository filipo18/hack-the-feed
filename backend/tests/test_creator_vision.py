from app.creator_report import _sample_frames, _send, _vision, _validate
from app.settings import load_settings
from threading import Barrier
from app.creator_report import run_creator_report


def posts(count=6):
    return [{"id": f"post-{i}", "platformId": str(i), "media": [{"frames": [
        {"id": f"frame-{i}-{j}", "url": f"https://images.example/{i}/{j}.jpg", "timestampSeconds": j * 5}
        for j in range(4)]}]} for i in range(count)]


def test_frames_cover_posts_before_taking_second_frames():
    frames = _sample_frames(posts())
    assert len(frames) == 10
    assert [frame["postId"] for frame in frames[:6]] == [f"post-{i}" for i in range(6)]
    assert len({frame["frameId"] for frame in frames}) == 10


def test_vision_cannot_cite_a_real_frame_that_was_not_sent():
    rows = posts(1)
    accepted, rejected = _validate(rows, [], [
        {"frameId": "frame-0-1", "name": "Nike", "entityType": "brand"},
    ], _sample_frames(rows))
    assert accepted == []
    assert rejected == [{"reason": "vision_not_tied_to_sent_frame"}]


def test_visual_brand_analysis_does_not_identify_people():
    rows = posts(1)
    accepted, rejected = _validate(rows, [], [
        {"frameId": "frame-0-0", "name": "Someone", "entityType": "person"},
    ], _sample_frames(rows))
    assert accepted == []
    assert rejected


def test_each_image_is_labeled_next_to_its_pixels(monkeypatch):
    monkeypatch.setenv("GMI_VISION", "1")
    captured = []

    def http(url, body, headers, timeout):
        captured.append(body)
        return 200, {"choices": [{"message": {"content": '{"observations":[]}'}}]}

    frames = _sample_frames(posts(2))
    assert _vision(http, load_settings(), frames)[0] == "complete"
    content = captured[0]["messages"][0]["content"]
    images = [(index, part) for index, part in enumerate(content) if part["type"] == "image_url"]
    assert len(images) == len(frames)
    for (index, _), frame in zip(images, frames):
        assert content[index - 1]["type"] == "text"
        assert frame["frameId"] in content[index - 1]["text"]


def test_creator_model_requests_use_the_separate_gmi_timeout(monkeypatch):
    monkeypatch.setenv("HTTP_TIMEOUT_SECONDS", "20")
    monkeypatch.setenv("GMI_HTTP_TIMEOUT_SECONDS", "120")
    timeouts = []

    def http(url, body, headers, timeout):
        timeouts.append(timeout)
        return 200, {}

    _send(http, load_settings(), {})
    assert timeouts == [120]


def test_text_and_vision_can_complete_without_waiting_on_each_other(monkeypatch):
    monkeypatch.setenv("ORIANE_API_KEY", "test")
    monkeypatch.setenv("GMI_API_KEY", "test")
    monkeypatch.setenv("GMI_MODEL", "test")
    barrier = Barrier(2)
    def text(*args):
        barrier.wait(timeout=2)
        return "complete", [], None
    def vision(*args):
        barrier.wait(timeout=2)
        return "complete", [], None
    monkeypatch.setattr("app.creator_report._text", text)
    monkeypatch.setattr("app.creator_report._vision", vision)
    def http(*args):
        row = {**posts(1)[0], "platform": "instagram", "profileHandle": "runner"}
        return 200, {"data": {"results": [row]}, "metadata": {"pagination": {"totalCount": 1}}}
    result = run_creator_report({"handle": "runner", "platform": "instagram"}, load_settings(), http)
    assert result["assessment"]["text"] == "complete"
    assert result["assessment"]["vision"] == "complete"
