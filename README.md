# BoB Blocks

A local-first Blockly editor for the Reachy 2 Python SDK. Build robot behaviors with colorful blocks and export readable Python. No backend, account, CDN, or robot connection is needed to use the editor. Blockly and all application assets are bundled locally.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal. After dependency installation, the editor works without internet access. `npm run build` creates the static site in `dist/`; `npm run preview` serves that build locally. Serve the files over HTTP rather than opening `index.html` directly. pnpm is also supported.

## Create a behavior

Choose a category in the left toolbox, drag blocks onto the canvas, and snap them together from top to bottom. Edit numeric fields in place. The Python preview updates automatically. Start with Hello, BoB or Open & close for an example. Undo/redo, zoom, fit, variables, functions, conditionals and repeat loops are available.

Projects autosave in browser local storage. Save project downloads a portable JSON file, and Open restores it. Clearing browser data removes the autosave, so keep a project file as a backup. Export Python downloads `bob_program.zip` containing `code.py` and `bob_code.py`. Extract both files into the same folder before running.

The editor fills the viewport below a fixed header, with a status footer at the bottom. File, Starters, View, and Settings menus hold secondary actions. On narrow screens, switch between Blocks and Python using the panel buttons. The page itself does not scroll; the workspace and code preview handle their own content. The mouse wheel zooms the block workspace; drag the background or use its scrollbars to pan. Toolbox flyouts and the code preview retain normal scrolling.

Each angle block has a small arrow that collapses or expands its values, including when already collapsed. The arrow supports Enter and Space. Collapse state is saved with the project and never changes generated Python. View → Collapse angles / Expand angles toggles all angle blocks together.

The header light/dark toggle starts from the operating system preference on every page load. Manual changes apply for the current session. The robot host stays visible in the project toolbar. Python syntax highlighting offers Match appearance, GitHub Light, GitHub Dark, Dracula, and Monokai. The code theme preference is stored on this device independently of project files; the appearance override is not persisted. Highlighting and Poppins font files are bundled locally and do not require Google Fonts requests or change the exported code.

## Run exported Python

Set the robot host in the editor. On a computer with Python and network access to the robot:

```sh
pip install reachy2-sdk
python code.py
```

Export Python includes bob_code.py alongside code.py in one ZIP; extract both files together. The helper library keeps constraints and rotation math out of student scripts. See [BoB Code, collision configuration, and custom model guidance](docs/bob-code.md).

The browser generates code; it cannot execute the Python SDK or directly control the robot. There is no simulator. Movement commands use `wait=True` so connected blocks execute sequentially. Gripper open/close and percentage opening commands are nonblocking; add a wait block if needed. Angles are degrees, distances are meters, and durations are seconds. Head orientation is roll/pitch/yaw; arm angles follow shoulder pitch/roll, elbow yaw/pitch, wrist roll/pitch/yaw. Relative motions use the robot frame; mobile-base goto uses odometry coordinates.

Review the generated program, robot configuration, joint limits, and clearance before execution. Head goto/rotation and arm goto/translation/rotation automatically check `is_on()` and call `turn_on()` for that part immediately before movement if needed. Checks run inside loops, conditionals, and functions, so a later movement re-enables motors after a turn-off block. Position readouts do not enable motors. Grippers and mobile-base moves still need explicit motor control. Named postures enable the available head/arms before their bounded movements. Turning motors off requires support for the robot. The generated `finally` block disconnects; it does not disable motors. Cancel-all is not a hardware emergency stop. No generated program has been tested against physical hardware.

## Block coverage

### Reusable head and arm positions

**Actuators** groups head, arm, and gripper controls in cyan. The existing direct movement blocks remain available. **Position Values** provides head and arm position value blocks: plug a number, number variable, or arithmetic expression into each joint input. These generate ordinary Python lists in degrees and never turn motors on or move the robot.

Under **Position Variables**, set/get blocks are preconfigured for `head_position`, `right_arm_position`, and `left_arm_position`. Connect a position builder or current-position readout to a setter, then plug the matching getter into **move head to position** or **move right/left arm to position**. Duration accepts a number or expression too. Motors are enabled only when a connected movement executes. A movement with no position connected exports a no-op comment. Existing numeric-field movement blocks continue to work as before.

Head positions hold `[roll, pitch, yaw]`; arm positions hold `[shoulder pitch, shoulder roll, elbow yaw, elbow pitch, wrist roll, wrist pitch, wrist yaw]`. Head and arm types cannot be connected to the wrong movement input. Both also work as lists for iteration, length, and item access. Python hints use `list[float]`. Set a variable before using it, retain the correct three/seven-element length when editing a list, and check joint limits before executing on hardware. Left and right arms share the same seven-angle format, so an arm position can be reused for either arm when appropriate.

Category colors distinguish setup (navy), actuators (cyan), mobile base (amber), logic (purple), values (gold), selection (coral), iteration (green), lists (teal), variables (rose), and functions (blue).

### Selection, iteration, and typed data

**Selection** contains ready-to-drag if, if/else, and if/elif presets. **Iteration** contains repeat-N-times, `for i in range`, while-condition, and for-item-in-list loops. The gear on an if block can add more branches. Range uses Python's exclusive stop value and accepts integer start/stop/step expressions; step must be nonzero and can be negative. Change the range variable or list-item name with its dropdown. A while loop needs its condition to become false to finish.

**Variables** has number, string, boolean, and list setters and getters. Use a block's dropdown to create or rename variables of that type. Typed inputs reject incompatible block connections. Python annotations use `int | float`, `str`, `bool`, and `list` (Python 3.10+); annotations describe intent and do not enforce runtime types. Assign variables before reading them. Lists can contain mixed element types. After placing a loop, its index or item appears under **Variables → Your variables & loop items** so it can be used inside the body. List items have an inferred runtime type rather than a fixed element type.

**Lists** provides empty/custom lists, repeated lists, length, emptiness checks, item lookup, item replacement, and search. Use the gear on a custom-list block to change the number of elements. A typed list getter plugs into the for-item loop's list input. **Logic** supplies booleans, comparisons, and/or/not. **Values** supplies numbers, arithmetic, text, print, and wait blocks. Existing saved programs using older loop or variable blocks remain supported.

Includes motor control, smooth shutdown, named postures, cancel-all, connection status, seven-joint arm goto, arm translation/rotation and position readout, head goto/look-at/rotation, gripper open/close/percentage/goto, mobile base goto/translation/rotation, timing, standard logic, arithmetic, text, variables, and functions. This is a focused core SDK subset, not every SDK method: camera/audio, trajectory recording, advanced kinematics, antennas, and low-level actuator controls are not included.

Method reference: [Pollen SDK documentation](https://pollen-robotics.github.io/reachy2-sdk/reachy2_sdk.html) and [official tutorials](https://docs.pollen-robotics.com/developing-with-reachy-2/basics/1-hello-world/). SDK behavior depends on the version installed on the execution computer.

## Publish through GitHub Pages

Push the repository when ready. In repository Settings → Pages, select GitHub Actions as the source, then manually run “Deploy to GitHub Pages” from the Actions tab. The included workflow builds and publishes `dist/`. Relative asset paths support repository subpaths. Nothing has been published automatically.

## Validation

`npm test` checks Python generation and project serialization. Python 3 must be available as `python` for syntax checks. `npm run build` validates the frontend bundle.

## BoB joint bounds and help

BoB Blocks applies the school-provided arm target bounds at movement time. Reversed endpoint pairs are normalized: right shoulder roll is -165°…20°, left shoulder roll is -20°…165°, and both elbow pitches are -125°…0°. Both wrists' roll/pitch bounds are -15°…15°; shoulder pitch, elbow yaw, and wrist yaw are -360°…360°. Idle ranges are displayed as guidance and are not clamps.

Direct arm-joint blocks keep the requested values visible, show a Blockly warning, and export corrected target literals plus a nonfatal logging warning. Saved/calculated positions are clamped by generated movement helpers when the program runs, leaving the original variable unchanged. Invalid, nonfinite, or incorrectly sized position lists log an error and skip that movement. Later blocks continue to execute. This does not suppress unrelated SDK or connection errors.

Relative arm translation/rotation uses the SDK's pose helpers and inverse kinematics, clamps the resulting joint target, then performs a blocking joint goto. Therefore clamping may change the requested Cartesian destination, and the movement uses joint interpolation. Named whole-robot postures use bounded arm targets sequentially and return the head to its default posture. [Arm SDK reference](https://pollen-robotics.github.io/reachy2-sdk/reachy2_sdk/parts/arm.html).

The supplied bounds are target restrictions, not collision avoidance or proof that a trajectory is safe. The Python library includes an optional sampled 3D collision checker, but it requires a calibrated primitive URDF model and joint mapping; no physical BoB collision model is bundled or enabled by default. They have been checked with mocked SDK tests, not physical hardware. Stored position values and current-position readouts are not clamped until used for movement.

Click a question mark beside an arm/head angle to open positive/negative direction notes and an isometric upper-body animation. The modal supports arm-side selection, pause/play, a manual angle slider, and reduced-motion preferences. The illustration uses locally bundled Three.js, smoothly filleted geometry, depth-tested rendering, and an isometric front/top/right camera. Eyes sit slightly in front of the head surface to avoid flickering from overlapping faces. A lightweight SVG fallback is available when WebGL is unavailable. Every animation uses the same rounded-prism torso, head, and arms, with the selected parent joint yellow and child joint green. Arm links align along Z at zero, with Z up: roll is rotation about X, pitch about Y, and yaw about Z, using the right-hand rule. Head facial features and rectangular hands make axial twist visible. This clarifies coordinate-axis rotation; it is not a calibrated robot model. The supplied left shoulder-pitch notes list both directions as negative, so its positive direction is explicitly marked as needing confirmation. Head roll, pitch, and yaw targets are each bounded to -45°…45°.

The application is branded BoB Blocks; project format and browser-storage identifiers are retained for compatibility with existing saved projects.

The Python preview can be closed with its × button, toggled from the workspace header, or toggled under View → Show/Hide Python preview. Hiding it expands the block editor to full width and the choice is remembered on this device. Python export and generation continue while hidden. On narrow screens, the Python panel button reopens it.

Head angle movement blocks clamp roll, pitch, and yaw to -45°…45°. Direct blocks display warnings and export corrected literals; saved/calculated values are bounded at movement time without changing the variable. Relative head rotations compose intrinsic-XYZ matrices in the robot frame, respecting the SDK's 10° pitch offset, then clamp the resulting joint angles. Gimbal-lock targets are reported and skipped. The Cartesian look-at block is skipped with a nonfatal error because the SDK solves its angles remotely; use head-position movement blocks when enforcing angular bounds. Named postures use the SDK default head posture [0, -10, 0], which is inside the supplied bounds.


## Visual whole-body poses

Use **Create pose** or the **set pose** block in Actuators / Movement to edit head and both arms with sliders and numeric fields. Drag the figure to orbit, scroll to zoom, or reset the camera. Saving stores all 17 values in one block and project file; Cancel preserves the previous values. The schematic preview does not perform collision detection. Exported `bob.set_pose` moves head, right arm, then left arm sequentially, with a duration per part. Joint-help previews also support camera orbit.
