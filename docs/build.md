# 7621EVB VRF NAT Image Build

The buildroot must keep the local feed entry pointing at the independent
`misectel_switch_luci` repository. Build the first-milestone image with:

```sh
./scripts/build-misectel-7621evb.sh
```

Set `JOBS` to limit parallelism. The script installs only the required local
feed packages, replaces `.config` with the tracked target seed, runs
`make defconfig`, builds with a repository-local `TMPDIR`, verifies that the
sysupgrade image exists and fits the 15936 KiB firmware partition,
then prints its SHA-256 checksum.

The profile contains HTTPS LuCI, the Misectel theme/dashboard, the VRF NAT
manager and UI, VRF/bridge support, and DS3231 RTC support. It deliberately
does not include hardware or software flow offload. Performance results are
reported separately and are not build acceptance gates.
