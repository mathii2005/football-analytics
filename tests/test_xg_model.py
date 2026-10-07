"""Position xG: geometry of a shot (distance and visible goal angle) and the
logistic model stored in the codebook."""

import math

from src.v1.models import shot_geometry, position_xg


def test_geometry_from_the_shooters_point_of_view():
    d, a = shot_geometry(105 - 11, 34)                 # penalty spot
    assert abs(d - 11) < 1e-6
    assert abs(a - 2 * math.atan(3.66 / 11)) < 1e-6    # the goal seen under ~37 degrees
    _, wide = shot_geometry(100, 5)                    # tight angle
    assert wide < math.radians(10)


def test_position_xg_falls_with_distance_and_angle_and_is_lower_for_headers():
    near, far = position_xg(100, 34, "FOOT", "OPEN"), position_xg(80, 34, "FOOT", "OPEN")
    assert 0.25 < near < 0.75 and far < 0.08 and near > far
    assert position_xg(94, 34, "HEAD", "OPEN") < position_xg(94, 34, "FOOT", "OPEN")
    assert position_xg(100, 8, "FOOT", "OPEN") < position_xg(100, 34, "FOOT", "OPEN")


def test_a_shot_with_a_clicked_position_uses_the_position_model():
    from src.v1.models import shot_xg
    from src.v1.timeline import Shot
    ours = Shot(1, 1, 0, "ON", "US", 5)
    xg, est = shot_xg(ours, {"pos": {"x": 100, "y": 34}, "body": "FOOT", "situation": "OPEN", "loc": "CENTRAL_BOX"})
    assert abs(xg - position_xg(100, 34, "FOOT", "OPEN")) < 1e-9 and not est
    theirs = Shot(2, 1, 0, "ON", "THEM", 0)                      # their shot at our goal: mirrored
    assert abs(shot_xg(theirs, {"pos": {"x": 5, "y": 34}, "body": "FOOT", "situation": "OPEN"})[0] - position_xg(100, 34, "FOOT", "OPEN")) < 1e-9
    assert shot_xg(ours, {"pos": "CANT_SEE", "loc": "SIX", "body": "FOOT", "situation": "OPEN"})[0] > 0.25   # table fallback
