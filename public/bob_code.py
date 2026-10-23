"""BoB Code 0.1.0: local Reachy 2 movement helpers, angles in degrees.

Keep this file next to code.py after extracting the Python export ZIP. Requires reachy2-sdk to connect.
Bounds are NOT collision avoidance. No calibrated collision model is bundled.
Optional CollisionGuard rejects sampled joint-space paths through a supplied checker.
"""
import logging
import math
import weakref
import xml.etree.ElementTree as ET

__version__ = "0.1.0"
warn = logging.warning
_guards = weakref.WeakKeyDictionary()


def look_at_unavailable():
    logging.error("BoB: Cartesian look_at skipped because its joint angles cannot be bounded before movement. Use move head to position.")


def _duration(value):
    try:
        value = float(value)
        if not math.isfinite(value) or value <= 0:
            raise ValueError("duration must be positive and finite")
        return value
    except (TypeError, ValueError, OverflowError) as error:
        logging.error("BoB: movement skipped: %s", error)
        return None


def _goto(part, target, duration):
    duration = _duration(duration)
    if duration is None:
        return None
    if part in _guards:
        guard, name = _guards[part]
        guard.check({name: target})
    if not part.is_on():
        part.turn_on()
    return part.goto(target, duration=duration, wait=True)

# BoB's school-tested joint bounds, in SDK joint order (degrees).
# Target bounds do not check collisions or guarantee an entire trajectory.
ARM_LIMITS = {"r_arm": [[-360, 360], [-165, 20], [-360, 360], [-125, 0], [-15, 15], [-15, 15], [-360, 360]], "l_arm": [[-360, 360], [-20, 165], [-360, 360], [-125, 0], [-15, 15], [-15, 15], [-360, 360]]}
JOINT_NAMES = ['shoulder pitch', 'shoulder roll', 'elbow yaw', 'elbow pitch', 'wrist roll', 'wrist pitch', 'wrist yaw']

def limit_arm(target, side):
    try:
        if side not in ARM_LIMITS:
            raise ValueError("arm side must be r_arm or l_arm")
        values = [float(value) for value in target]
        if len(values) != 7 or not all(math.isfinite(value) for value in values):
            raise ValueError("expected seven finite joint angles")
    except (TypeError, ValueError, OverflowError) as error:
        logging.error("BoB: invalid %s position; movement skipped: %s", side, error)
        return None
    corrected = []
    for name, value, (low, high) in zip(JOINT_NAMES, values, ARM_LIMITS[side]):
        bounded = min(high, max(low, value))
        if bounded != value:
            logging.warning("BoB: %s %s requested %s deg, outside [%s, %s]; using %s deg", side, name, value, low, high, bounded)
        corrected.append(bounded)
    return corrected

def move_arm(arm, side, target, duration):
    bounded = limit_arm(target, side)
    if bounded is not None:
        return _goto(arm, bounded, duration)

def relative_arm(arm, side, duration, translation=None, rotation=None):
    try:
        pose = arm.get_translation_by(*translation) if translation is not None else arm.get_rotation_by(*rotation)
        target = arm.inverse_kinematics(pose)
    except (ValueError, TypeError) as error:
        logging.error("BoB: cannot solve %s relative movement; skipped: %s", side, error)
        return None
    return move_arm(arm, side, target, duration)

def goto_posture(robot, posture, duration):
    for side in ("r_arm", "l_arm"):
        arm = getattr(robot, side, None)
        if arm is not None:
            move_arm(arm, side, arm.get_default_posture_joints(posture), duration)
    head = getattr(robot, "head", None)
    if head is not None:
        move_head(head, [0, -10, 0], duration)

def limit_head(target):
    try:
        values = [float(value) for value in target]
        if len(values) != 3 or not all(math.isfinite(value) for value in values):
            raise ValueError("expected three finite head angles")
    except (TypeError, ValueError, OverflowError) as error:
        logging.error("BoB: invalid head position; movement skipped: %s", error)
        return None
    bounded = []
    for name, value in zip(("roll", "pitch", "yaw"), values):
        corrected = min(45, max(-45, value))
        if corrected != value:
            logging.warning("BoB: head %s requested %s deg; using %s deg (bounds -45 to 45)", name, value, corrected)
        bounded.append(corrected)
    return bounded


def move_head(head, target, duration):
    bounded = limit_head(target)
    if bounded is not None:
        return _goto(head, bounded, duration)

def _head_matrix(angles):
    r, p, y = [math.radians(value) for value in angles]
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    # Intrinsic XYZ, matching the SDK's quaternion_from_euler_angles.
    return [[cp*cy, -cp*sy, sp], [cr*sy+sr*sp*cy, cr*cy-sr*sp*sy, -sr*cp], [sr*sy-cr*sp*cy, sr*cy+cr*sp*sy, cr*cp]]

def relative_head(head, delta, duration):
    current = list(head.get_current_positions())
    if len(current) != 3:
        logging.error("BoB: cannot read head position; relative move skipped")
        return None
    # SDK neck joint space has a 10-degree pitch offset from Cartesian space.
    initial = _head_matrix([current[0], current[1]+10, current[2]])
    rotation = _head_matrix(delta)
    matrix = [[sum(rotation[i][k]*initial[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    pitch = math.asin(min(1, max(-1, matrix[0][2])))
    if abs(math.cos(pitch)) < 1e-8:
        logging.error("BoB: ambiguous head orientation at gimbal lock; relative move skipped")
        return None
    target = [math.degrees(math.atan2(-matrix[1][2], matrix[2][2])), math.degrees(pitch)-10, math.degrees(math.atan2(-matrix[0][1], matrix[0][0]))]
    return move_head(head, target, duration)


def set_pose(robot, *, head, right_arm, left_arm, duration=2):
    """Validate all values first; move head, right arm, left arm in that order.

    Sequential blocking moves deliberately avoid unsynchronised arm trajectories.
    Each segment is checked from live state when a collision model is enabled.
    """
    targets = {"head": limit_head(head), "r_arm": limit_arm(right_arm, "r_arm"),
               "l_arm": limit_arm(left_arm, "l_arm")}
    if any(value is None for value in targets.values()) or _duration(duration) is None:
        return None
    if any(getattr(robot, name, None) is None for name in targets):
        logging.error("BoB: set pose requires a head and both arms; skipped")
        return None
    for name, target in targets.items():
        _goto(getattr(robot, name), target, duration)


class CollisionRejected(RuntimeError):
    """Movement was not sent because its collision check failed."""


def _dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def _add(a, b):
    return [x+y for x, y in zip(a, b)]


def _sub(a, b):
    return [x-y for x, y in zip(a, b)]


def _mv(matrix, point):
    return [_dot(row, point) for row in matrix]


def _mm(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


_IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]


def _axis_rotation(axis, angle):
    length = math.sqrt(_dot(axis, axis))
    if length < 1e-12:
        raise ValueError("zero joint axis")
    x, y, z = [n/length for n in axis]
    c, s, t = math.cos(angle), math.sin(angle), 1-math.cos(angle)
    return [[t*x*x+c, t*x*y-s*z, t*x*z+s*y],
            [t*x*y+s*z, t*y*y+c, t*y*z-s*x],
            [t*x*z-s*y, t*y*z+s*x, t*z*z+c]]


def _origin(element):
    origin = element.find("origin")
    xyz = _numbers(origin.get("xyz", "0 0 0") if origin is not None else "0 0 0")
    r, p, y = _numbers(origin.get("rpy", "0 0 0") if origin is not None else "0 0 0")
    # URDF fixed-axis roll, pitch, yaw: Rz * Ry * Rx.
    rotation = _mm(_axis_rotation([0, 0, 1], y),
                   _mm(_axis_rotation([0, 1, 0], p), _axis_rotation([1, 0, 0], r)))
    return rotation, xyz


def _numbers(text):
    values = [float(value) for value in text.split()]
    if len(values) != 3 or not all(math.isfinite(value) for value in values):
        raise ValueError("expected three finite coordinates")
    return values


def _compose(parent, local):
    rotation, position = parent
    r, p = local
    return _mm(rotation, r), _add(position, _mv(rotation, p))


def _overlap(first, second, margin):
    """Separating-axis test for oriented boxes, with conservative padding."""
    ra, ca, ha = first
    rb, cb, hb = second
    axes_a, axes_b = list(zip(*ra)), list(zip(*rb))
    axes = list(axes_a) + list(axes_b)
    for a in axes_a:
        for b in axes_b:
            axes.append([a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]])
    for axis in axes:
        length = math.sqrt(_dot(axis, axis))
        if length < 1e-10:
            continue
        axis = [n/length for n in axis]
        extent_a = sum((h+margin)*abs(_dot(a, axis)) for h, a in zip(ha, axes_a))
        extent_b = sum((h+margin)*abs(_dot(b, axis)) for h, b in zip(hb, axes_b))
        if abs(_dot(_sub(cb, ca), axis)) > extent_a+extent_b:
            return False
    return True


class CollisionModel:
    """Headless 3D kinematics and collision checks, using a simplified URDF.

    Supply an expanded URDF with box/sphere/cylinder collision geometry, in meters.
    Spheres and cylinders use conservative enclosing boxes. Meshes are rejected:
    replace them with measured enclosing primitives, not visual approximations.
    joint_map maps URDF joint names to ("head"|"r_arm"|"l_arm", SDK angle index).
    All nonfixed joints must be mapped; fixed joint offsets come from the URDF.
    excluded_pairs explicitly lists touching/adjacent link pairs to ignore.
    No default BoB geometry is supplied: pivots, offsets, signs and body volumes
    must be measured/validated against your particular robot before hardware use.
    """

    def __init__(self, path, joint_map, *, excluded_pairs=(), margin=0.01, step_degrees=1, validated=False):
        self.validated = validated
        self.joint_map = dict(joint_map)
        self.excluded = {frozenset(pair) for pair in excluded_pairs}
        self.margin, self.step = float(margin), float(step_degrees)
        if not math.isfinite(self.margin) or self.margin < 0 or not math.isfinite(self.step) or self.step <= 0:
            raise ValueError("invalid margin or sample step")
        root = ET.parse(path).getroot()
        self.links = {link.attrib["name"]: link for link in root.findall("link")}
        self.joints = []
        children = set()
        self.boxes = []
        for joint in root.findall("joint"):
            name, kind = joint.attrib["name"], joint.attrib["type"]
            if kind not in ("fixed", "revolute", "continuous"):
                raise ValueError("unsupported joint type: "+kind)
            if kind != "fixed" and name not in self.joint_map:
                raise ValueError("unmapped joint: "+name)
            parent, child = joint.find("parent").attrib["link"], joint.find("child").attrib["link"]
            if parent not in self.links or child not in self.links or child in children:
                raise ValueError("invalid URDF tree")
            children.add(child)
            axis = joint.find("axis")
            self.joints.append((name, kind, parent, child, _origin(joint),
                                _numbers(axis.get("xyz", "1 0 0") if axis is not None else "1 0 0")))
        roots = set(self.links)-children
        if len(roots) != 1:
            raise ValueError("URDF must have one connected root")
        self.root = roots.pop()
        for name, link in self.links.items():
            for collision in link.findall("collision"):
                geometry = collision.find("geometry")
                box, sphere, cylinder = geometry.find("box"), geometry.find("sphere"), geometry.find("cylinder")
                if box is not None:
                    size = _numbers(box.attrib["size"])
                elif sphere is not None:
                    size = [2*float(sphere.attrib["radius"])]*3
                elif cylinder is not None:
                    size = [2*float(cylinder.attrib["radius"])]*2+[float(cylinder.attrib["length"])]
                else:
                    raise ValueError("unsupported collision geometry on "+name+"; use enclosing primitives")
                if not all(math.isfinite(n) and n > 0 for n in size):
                    raise ValueError("invalid collision dimensions")
                self.boxes.append((name, _origin(collision), [n/2 for n in size]))
        if len(self.boxes) < 2:
            raise ValueError("collision model needs at least two collision volumes")

    def collisions(self, state):
        transforms = {self.root: (_IDENTITY, [0, 0, 0])}
        pending = self.joints[:]
        while pending:
            progress = False
            for joint in pending[:]:
                name, kind, parent, child, origin, axis = joint
                if parent not in transforms:
                    continue
                transform = _compose(transforms[parent], origin)
                if kind != "fixed":
                    part, index = self.joint_map[name]
                    value = float(state[part][index])
                    if not math.isfinite(value):
                        raise ValueError("invalid state angle")
                    transform = _compose(transform, (_axis_rotation(axis, math.radians(value)), [0, 0, 0]))
                transforms[child] = transform
                pending.remove(joint)
                progress = True
            if not progress:
                raise ValueError("disconnected or cyclic URDF")
        boxes = [(name, (*_compose(transforms[name], origin), half)) for name, origin, half in self.boxes]
        hits = []
        for i, (a, box_a) in enumerate(boxes):
            for b, box_b in boxes[i+1:]:
                if a == b or frozenset((a, b)) in self.excluded:
                    continue
                if _overlap(box_a, box_b, self.margin):
                    hits.append((a, b))
        return hits

    def check_path(self, start, targets):
        if not start or set(targets)-set(start):
            raise ValueError("target part missing from current state")
        for name, values in start.items():
            if not values or not all(math.isfinite(float(n)) for n in values):
                raise ValueError("invalid starting state")
        if any(len(values) != len(start[name]) or not all(math.isfinite(float(n)) for n in values)
               for name, values in targets.items()):
            raise ValueError("invalid target state")
        end = {name: list(values) for name, values in start.items()}
        end.update({name: list(values) for name, values in targets.items()})
        distance = max(abs(b-a) for name in end for a, b in zip(start[name], end[name]))
        count = max(1, math.ceil(distance/self.step))
        if count > 10000:
            raise CollisionRejected("BoB: path needs too many samples; movement not sent")
        for sample in range(count+1):
            t = sample/count
            state = {name: [a+(b-a)*t for a, b in zip(start[name], end[name])] for name in end}
            hits = self.collisions(state)
            if hits:
                raise CollisionRejected(f"BoB: predicted collision {hits[0][0]} / {hits[0][1]} at {t:.0%}; movement not sent")


class CollisionGuard:
    def __init__(self, robot, model):
        self.robot, self.model = robot, model

    def check(self, targets):
        try:
            state = {}
            for name, count in (("head", 3), ("r_arm", 7), ("l_arm", 7)):
                part = getattr(self.robot, name, None)
                if part is None:
                    raise ValueError("collision checking requires head and both arms")
                # A previously queued/active command invalidates the planned starting state.
                if part.get_goto_playing().id != -1 or part.get_goto_queue():
                    raise ValueError("robot has active or queued movements")
                values = [float(n) for n in part.get_current_positions()]
                if len(values) != count or not all(math.isfinite(n) for n in values):
                    raise ValueError("unreadable joint state")
                state[name] = values
            self.model.check_path(state, targets)
        except CollisionRejected:
            raise
        except Exception as error:
            raise CollisionRejected("BoB: collision check unavailable; movement not sent: "+str(error)) from error


def enable_collision_checking(robot, model):
    """Enable rejection checks on bob_code head/arm moves; raw SDK calls bypass it.

    Collision errors stop the script rather than continuing from an unexpected pose.
    Checking is sampled, not continuous, and assumes stationary uncommanded joints,
    joint-space interpolation, no other clients, and a calibrated enclosing model.
    This does not model torque, cables, fingers, obstacles or external forces unless
    represented by geometry. It is not a hardware safety controller.
    """
    if not model.validated:
        raise ValueError("Calibrate and validate the collision model against BoB before enabling hardware checks")
    expected = {(part, i) for part, count in (("head", 3), ("r_arm", 7), ("l_arm", 7)) for i in range(count)}
    if set(tuple(value) for value in model.joint_map.values()) != expected:
        raise ValueError("collision model must map all 17 head/arm joint angles")
    guard = CollisionGuard(robot, model)
    for name in ("head", "r_arm", "l_arm"):
        part = getattr(robot, name, None)
        if part is None:
            raise ValueError("collision checking requires head and both arms")
    for name in ("head", "r_arm", "l_arm"):
        _guards[getattr(robot, name)] = (guard, name)
    return guard
