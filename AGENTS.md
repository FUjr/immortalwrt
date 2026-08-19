# Repository Guidelines

ImmortalWrt source tree for the Misectel 7621EVB VRF NAT gateway. Two device
profiles are built here: 16 MiB `misectel_7621evb` and the 32 MiB dual-slot
`misectel_7621evb-32m` (A/B firmware slots + U-Boot env rollback).

In-tree board/kernel/DTS changes go in `target/linux/ramips/`; docs in `docs/`;
`bin/` is build output. Application/package code lives in the feed (see below),
not in this tree.

## Critical: the feed is a separate repo (symlink)

- `feeds/misectel` is a symlink to the independent `/home/fjr/work/misectel_switch_luci`
  repository. Application packages and LuCI modules (`misectel-switch-manager`,
  `misectel-vrf-manager`, `luci-app-misectel-*`, etc.) are edited THERE, then built
  here. Changes to feed packages must not be committed in this tree.
- After changing a package dependency in a feed Makefile (e.g. adding a
  `+kmod-sched-*`), you MUST run `make defconfig` before `make`, or the build fails
  at `package/install` with `no such package`.

## Build

Prefer the canonical build scripts (they install feed packages, copy the tracked
seed into `.config`, run `make defconfig`, build, and verify image size/manifest):

- `./scripts/build-misectel-7621evb.sh` — 16 MiB image (seed `configs/misectel-7621evb.config`).
- `./scripts/build-misectel-7621evb-32m.sh` — 32 MiB dual-slot image (seed `configs/misectel-7621evb-32m.config`).

Set `JOBS` to limit parallelism. Other useful commands:

- `make package/misectel-switch-manager/{clean,compile} V=s` — rebuild a single feed package.
- `make menuconfig` / `./scripts/diffconfig.sh` — select / inspect config.
- `git diff --check` — whitespace check before committing.

Output images land in `bin/targets/ramips/mt7621/`; `bin/` is build output, not source.

## Validation

There is no unit-test framework and `scripts/check-switch-manager.sh` does not
exist. Validate narrowly instead:

- Shell scripts: `sh -n` (POSIX shell; the apply/validate scripts live in the feed).
- LuCI JS (`index.js`): `node --check`.
- ucode rpcd scripts (`*.ucode`, `misectel.switch`/`misectel.vrf`): cannot be
  syntax-checked on the host (no `ucode` binary) — review against existing patterns.
- Full image build when release artifacts are affected.

## Device access & flashing (hard-won)

- Serial console: `/dev/ttyCH343USB0`, 115200 8N1, logs straight into a root shell
  (no password on console). Use pyserial or `screen`. If silent at every baud, the
  board's UART header is disconnected — power-cycle the board.
- Device networking: each `br-vrf<N>` bridge (192.168.10.1) is isolated in its own
  VRF namespace `vrf-vrf<N>`; the **main** routing table only has `wan` (which flaps
  up/down as an upstream environmental issue). To reach the host/LAN from the device,
  run `ip vrf exec vrf-vrf<N> <cmd>`.
- Flash flow: serve the sysupgrade image from the host (`python3 -m http.server <port>`
  — host ports 8000/8080/18080 are already occupied), then on the device
  `ip vrf exec vrf-vrf<N> wget -O /tmp/fw.bin http://<host>:<port>/<image>` and
  `sysupgrade /tmp/fw.bin`. Verify SHA-256 both sides first.
- `sysupgrade` **preserves `/etc/config`** by default (`-n` = clean). New UCI sections
  (e.g. a newly added `qos` section) are NOT auto-added to a preserved config — add
  them with `uci set` after flash.
- The device uses **APK**, not opkg: `apk list --installed` (opkg returns nothing).

## Style

Follow surrounding OpenWrt style. Tabs in Makefiles and device-tree files; POSIX
shell for scripts; descriptive `snake_case` UCI options. Remove dead code rather than
leaving compatibility fragments.

## Design docs, commits & docs

- Non-trivial features (new UCI sections, RPC/API surfaces, MIBs, protocols, config
  schema) require a **Chinese design doc in `docs/<feature>-design.md` before/alongside
  the code**, following the existing template (`docs/snmp-mib-design.md`): header with
  project/device/author/date/version, a 文档目的 section, then structured technical
  sections (objects, mapping, behavior, validation). Reference it from `docs/requirements.md`.
- One commit per logical change, detailed **Chinese** message (what/why/how-verified).
- Never commit passwords, keys, tokens, or serial logs. Update `docs/` when interfaces,
  config data, workflows, or behavior change — see `docs/requirements.md`,
  `docs/architecture.md`, `docs/build.md`, `docs/validation.md`, `docs/delivery-report.md`.
