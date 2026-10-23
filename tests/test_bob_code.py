import math
import sys
import io
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "public"))
import bob_code as bob


class Part:
    def __init__(self, count=7):
        self.position = [0]*count
        self.sent = []
        self.on = False
        self.playing = -1
        self.queue = []
    def get_current_positions(self): return self.position[:]
    def get_goto_playing(self): return SimpleNamespace(id=self.playing)
    def get_goto_queue(self): return self.queue
    def is_on(self): return self.on
    def turn_on(self): self.on = True
    def goto(self, target, duration, wait):
        self.sent.append((target, duration, wait))
        self.position = target[:]


class RuntimeTests(unittest.TestCase):
    def test_invalid_input_does_not_enable_motors(self):
        arm = Part()
        bob.move_arm(arm, "r_arm", [float("nan")]*7, 2)
        bob.move_arm(arm, "unknown", [0]*7, 2)
        bob.move_arm(arm, "r_arm", [0]*7, -1)
        self.assertFalse(arm.on)
        self.assertEqual(arm.sent, [])

    def test_pose_validates_every_part_before_moving(self):
        robot = SimpleNamespace(head=Part(3), r_arm=Part(), l_arm=Part())
        bob.set_pose(robot, head=[0]*3, right_arm=[0]*7, left_arm=[0], duration=2)
        self.assertFalse(robot.head.on)
        bob.set_pose(robot, head=[0]*3, right_arm=[0]*7, left_arm=[0]*7, duration=3)
        self.assertTrue(all(len(part.sent) == 1 for part in (robot.head, robot.r_arm, robot.l_arm)))
        self.assertEqual(robot.head.sent[0], ([0, 0, 0], 3, True))

    def model(self, geometry='<box size="0.2 0.2 0.2"/>'):
        # Synthetic test rig, not Reachy geometry: arm sweeps through a box at +X.
        path = io.StringIO(f'''<robot name="test"><link name="body"><collision><origin xyz="1 0 0"/><geometry><box size="0.2 0.2 0.2"/></geometry></collision></link><link name="arm"><collision><origin xyz="1 0 0"/><geometry>{geometry}</geometry></collision></link><joint name="hinge" type="revolute"><parent link="body"/><child link="arm"/><axis xyz="0 0 1"/></joint></robot>''')
        return bob.CollisionModel(path, {"hinge": ("r_arm", 0)}, margin=0, step_degrees=1)

    def test_path_rejects_middle_collision_even_with_clear_endpoints(self):
        model = self.model()
        self.assertEqual(model.collisions({'r_arm': [-90]}), [])
        self.assertEqual(model.collisions({'r_arm': [90]}), [])
        with self.assertRaisesRegex(bob.CollisionRejected, 'body / arm'):
            model.check_path({'r_arm': [-90]}, {'r_arm': [90]})
        model.check_path({'r_arm': [-90]}, {'r_arm': [-60]})

    def test_meshes_and_unvalidated_models_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unsupported collision geometry'):
            self.model('<mesh filename="imaginary.stl"/>')
        with self.assertRaisesRegex(ValueError, 'Calibrate'):
            bob.enable_collision_checking(SimpleNamespace(), self.model())
        incomplete = self.model()
        incomplete.validated = True
        with self.assertRaisesRegex(ValueError, 'all 17'):
            bob.enable_collision_checking(SimpleNamespace(), incomplete)

    def test_guard_refuses_collision_or_unavailable_checks_before_power(self):
        robot = SimpleNamespace(head=Part(3), r_arm=Part(), l_arm=Part())
        model = self.model()
        robot.r_arm.position[0] = -90
        guard = bob.CollisionGuard(robot, model)
        bob._guards[robot.r_arm] = (guard, "r_arm")
        with self.assertRaises(bob.CollisionRejected):
            bob.move_arm(robot.r_arm, "r_arm", [90, 0, 0, 0, 0, 0, 0], 2)
        self.assertFalse(robot.r_arm.on)
        self.assertEqual(robot.r_arm.sent, [])
        robot.l_arm.queue = [1]
        with self.assertRaisesRegex(bob.CollisionRejected, 'queued'):
            bob.move_arm(robot.r_arm, "r_arm", [-60, 0, 0, 0, 0, 0, 0], 2)
        robot.l_arm.queue = []
        robot.head.position[0] = float('nan')
        with self.assertRaisesRegex(bob.CollisionRejected, 'unreadable'):
            bob.move_arm(robot.r_arm, "r_arm", [-60, 0, 0, 0, 0, 0, 0], 2)
        self.assertFalse(robot.r_arm.on)
        robot.head.position[0] = 0
        bob.move_arm(robot.r_arm, "r_arm", [-60, 0, 0, 0, 0, 0, 0], 2)
        self.assertEqual(len(robot.r_arm.sent), 1)

    def test_separating_axes_respect_box_rotation_and_margin(self):
        first = (bob._IDENTITY, [0, 0, 0], [1, .1, .1])
        second = (bob._axis_rotation([0, 0, 1], math.pi/2), [0, .5, 0], [1, .1, .1])
        self.assertTrue(bob._overlap(first, second, 0))
        self.assertFalse(bob._overlap(first, (bob._IDENTITY, [0, .5, 0], [1, .1, .1]), 0))
        self.assertTrue(bob._overlap(first, (bob._IDENTITY, [0, .5, 0], [1, .1, .1]), .2))


if __name__ == '__main__':
    unittest.main()
