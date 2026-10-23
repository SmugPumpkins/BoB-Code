# BoB Code

`public/bob_code.py` is a standalone local Python module, version 0.1.0. Export Python bundles it with `code.py` in `bob_program.zip`. Extract both files together. A separate download remains available under **File → Download bob_code.py**. Install `reachy2-sdk` in the Python environment used to run the script. No separate bob_code installation, browser server, or internet connection is required to import the module.

A student movement is now one call:

```python
import bob_code as bob

bob.move_head(reachy.head, [0, -10, 20], 2)
```

The library validates finite targets and positive durations, clamps school-provided joint bounds, enables only the required motors, waits for movement completion, and handles relative rotation math. Out-of-range angles produce warnings; invalid targets are skipped before motor enable. Other SDK failures propagate. Whole-body `bob.set_pose(...)` validates all targets first, then moves head, right arm, and left arm sequentially. Its duration applies to each part, not the whole sequence. It does not synchronize simultaneous trajectories.

## Collision simulation in Python

The module includes a headless kinematic collision checker. It needs no graphics window or physics engine. It transforms simple 3D collision volumes along a sampled joint-space path and applies oriented-box intersection tests. A collision raises `CollisionRejected` before that movement is sent. Unlike angle clamping, a rejected collision stops the program: continuing from an unexpected position could invalidate later movements. Existing generated `finally` cleanup disconnects, but does not disable motors.

**Collision checking is not enabled by default. No calibrated BoB collision model is included.** The website's figure is a schematic; it is deliberately not used as a physical collision model. Downloading the module alone does not provide self-collision protection on the robot.

To configure it, an instructor supplies:

1. An expanded, simplified URDF for the particular robot, in meters and radians, with measured joint origins/axes and enclosing collision volumes. Fixed offsets belong in the URDF. Box geometry is supported directly. Spheres and cylinders use conservative enclosing boxes. Meshes, Xacro expressions, prismatic joints, and unsupported geometry are rejected rather than silently omitted. A visual mesh can be much more detailed than the collision geometry.
2. A mapping from every moving URDF joint name to its SDK part and angle index. All 17 head/arm joint angles must be mapped before enabling the guard: head roll/pitch/yaw; each arm's shoulder pitch/roll, elbow yaw/pitch, wrist roll/pitch/yaw. Validate SDK zero poses, offsets, rotation order and signs against the model. Include torso, head, arms, grippers, antennas, and other protrusions in enclosing geometry as appropriate; the checker cannot detect collisions with absent geometry.
3. Explicit pairs of normally touching links to exclude. There are no automatically ignored adjacent links. Excluding too many pairs creates blind spots.
4. Validation against BoB, including measured clearance, known collisions, near misses, the full range of motions, and the installed SDK's actual interpolation. `validated=True` records the instructor's validation; it does not perform or certify it.

Pollen's [official Reachy 2 descriptions](https://github.com/pollen-robotics/reachy2_core/tree/develop/reachy_description) are a useful starting point. Different hardware configurations have different offsets. Their mesh-based description needs enclosing primitive collision geometry for this lightweight checker.

Example instructor configuration, placed after connection and before movement:

```python
import json
import bob_code as bob

# Locally maintained mapping, e.g. {"actual_neck_roll_joint": ["head", 0], ...}
with open("bob_joint_map.json", encoding="utf-8") as file:
    joint_map = json.load(file)

model = bob.CollisionModel(
    "bob_collision.urdf",
    joint_map,
    excluded_pairs=[("actual_parent_link", "actual_touching_child_link")],
    margin=0.01,        # 1 cm padding per box, validate for your robot
    step_degrees=1,    # maximum joint-angle increment between samples
    validated=True,   # only after validation on the actual robot
)
bob.enable_collision_checking(reachy, model)
```

The guard reads current angles for head and both arms before each move. It refuses unavailable/invalid state and any active or queued movements. All bob_code head/arm helpers, including relative movements and named postures, pass through the same guard. Raw SDK calls and gripper/mobile-base blocks bypass it. Use a single controlling client; external commands or physical disturbances after the check invalidate its assumptions.

This is sampled collision rejection, not a motion planner or continuous collision guarantee. It does not reroute around collisions, monitor execution, detect external obstacles without geometry, model cable/force/dynamic effects, or provide a hardware emergency stop. Small collisions can fall between samples; geometric padding and smaller steps reduce that risk but do not prove safety. The model must match joint-space trajectories and remain valid for stationary, uncommanded parts. Do not enable it as a substitute for supervised hardware validation.

## Visual pose and future meshes

**Create pose** in the workspace header, or **Actuators → Movement → set pose**, opens the visual editor. Use the Head, Right arm, and Left arm tabs; all values remain in the same live pose. Sliders and numeric fields follow the supplied bounds. Save updates one block; Cancel leaves the project unchanged. Existing pose blocks reopen with their saved values. The pose is stored in the project JSON and exports one library call.

The joint-help and pose previews support drag-to-orbit, wheel/pinch zoom, and Reset view. If WebGL is unavailable, numeric editing remains available with a clearly identified static fallback.

Custom Reachy parts can replace the schematic geometry later. Prefer individual GLB/glTF parts, with meters as units, consistent orientation, and origins at their joint pivots. Keep torso, head, upper arms, forearms, wrists, and grippers separate so they can be attached to the joint hierarchy. A combined model also works if its individual moving parts remain separate named nodes. Supply measurements and joint offsets along with the visual assets. Detailed visuals and simple collision envelopes should remain separate: better-looking geometry alone does not validate collision detection.

## Verification

`npm test` runs generator/serialization tests and the Python runtime suite. Synthetic fixtures verify an intermediate collision with clear endpoints, an allowed path, rotated boxes, margins, unsupported geometry rejection, unvalidated-model rejection, active/queued-command rejection, and rejection before motor enable. These tests use synthetic geometry and mocked hardware; no physical Reachy has been exercised.
