<img src="https://avatars.githubusercontent.com/u/53193414?s=200&v=4" alt="logo" width="200" height="200" align="right">

# Project ImmortalWrt

## Misectel MT7621 VRF NAT Gateway

The `misectel-switch` branch builds the `misectel,7621evb` gateway for isolating
overlapping IPv4 device networks and exposing them through distinct WAN-side
host addresses or host-bit-preserving routed prefixes. Project requirements,
architecture, build constraints, and the
acceptance matrix are maintained in [`docs/requirements.md`](docs/requirements.md)
and [`docs/architecture.md`](docs/architecture.md).

The isolated VRF paths intentionally use Linux software forwarding so policy
routing and NAT selection remain observable and deterministic. Firewall4's
global flow offload stays disabled. API/UCI v8 can convert exactly one selected
VRF definition into a non-overlapping ordinary LAN and install a hardware
flowtable restricted to that LAN and WAN. Performance measurements remain
non-gating and hardware acceleration requires device-side counter verification.

The target is `misectel_7621evb`, with 256 MiB DDR3 SDRAM and 16 MiB SPI NOR.
Its Ethernet layout exposes MT7530 port 0 as the actual WAN, ports 1-3 as
LAN1-3, and the separate `gmac1`/PHY4 interface as LAN4.
Its flash map preserves dedicated `woem` and `ledeinfo` partitions following
the Misectel MT7981 convention, and adds VRF/bridge modules plus support for an
externally wired PCF85063AT RTC. Its first-milestone image includes HTTPS LuCI,
the Misectel theme, and the dedicated VRF NAT manager and application. Use
`scripts/build-misectel-7621evb.sh` for a size-checked reproducible build.
The current switch-operations release also includes a Misectel LuCI frontend
and backend for fixed-port state/rate/flow control, MAC security, passive
performance and error monitoring, searchable volatile events, SNMPv3
SHA-256/AES-256, standard MIBs and Traps, LLDP topology, storm suppression,
and configurable ping response. Monitoring does not install forwarding hooks;
rate and storm policers are present only when explicitly configured.
The image also includes the VRF-aware static ARP/IP-MAC and Proxy ARP manager,
seven-class DoS and ARP/DHCP guard policy, same-VRF physical-port Redirect,
Web/NMS role management, lightweight Syslog over TLS with a target whitelist,
and customer HTTPS server-certificate import and rollback.
Switch manager release 11 has been exercised on the target with live MAC-table
queries, structured rejection of malformed API candidates, software ingress
and egress policing, multicast storm suppression, searchable security events,
SNMPv3 SHA-256/AES-256, and MIB-II/IF-MIB/EtherLike/LLDP-MIB queries.
Switch manager release 13 separates the MT7621 Ethernet IRQ, packet steering,
and management monitoring workloads across logical CPUs. It restores IRQ,
RPS, and XPS settings after service or network reload, starts the switch
watcher on CPU3 at nice level 10, samples basic port counters every 10 seconds,
and limits MAC-table and LLDP scans to one run every 30 seconds.
The build produces a standalone U-Boot and, when `BASE_MAC` is supplied, an
exact 16 MiB programmer image with Factory, WOEM and LEDEINFO regions.
The build also asserts the required MT7621 SPI and SPL LZMA options before
publishing boot artifacts, then refreshes the target-wide `sha256sums` after
the standalone U-Boot and programmer image have been composed.
Build and hardware validation boundaries are recorded in
[`docs/validation.md`](docs/validation.md).
The minimum complete subnet-NAT isolation test uses three endpoint devices plus
the gateway; see [`docs/subnet-nat-test.md`](docs/subnet-nat-test.md).
Manager release 10 has been exercised on the target with two simultaneous VRFs
using the same internal address, distinct bidirectional prefix NAT, HTTPS
transaction apply/confirm, restart recovery, protected first-run state,
administratively enabled WAN/LAN links, and HTTP to HTTPS management
redirection with TLS 1.2 and TLS 1.3. The exact tested scope and remaining
LAN3/LAN4, UDP, routed-prefix, rollback, certificate provisioning, and
performance gaps are recorded in the validation document.
API/UCI v8 keeps editable VRF/interface membership, adds an optional lightweight
DHCP server and static reservations per VRF bridge, and leaves WAN protocol,
address, gateway, DNS and link ownership with `network.wan`/netifd. HTTP and
HTTPS management are both reachable from WAN by default, without forcing port
80 to redirect to TLS. The gateway
homepage reads WAN state from netifd and member carrier/speed from the VRF
runtime API. It also supports one ordinary HNAT LAN, with its LuCI controls
shown only when the UCI/NMS visibility policy permits them. Core Web workflows
and screenshots are documented in
[`docs/delivery-report.md`](docs/delivery-report.md).
SNMP MIB inventory, configuration examples, live OID/Trap evidence, and the
current SET/PEN limitations are documented in
[`docs/snmp-mib-delivery-report.md`](docs/snmp-mib-delivery-report.md).
The requirement-traceable test suite is available as a balanced left/right
[`XMind`](docs/testcases/7621-nat-gateway-requirements-testcases.xmind) and
[`Markdown`](docs/testcases/7621-nat-gateway-requirements-testcases.md), with a
separate [`coverage report`](docs/testcases/7621-nat-gateway-coverage.md).
The main delivery report records the recoverable security-feature validation,
bidirectional multicast NAT proof, and RTL8152 performance runs. The 2026-08-07
regression passed 15Kpps with stimulus margin and found no measurable MAC-policy
throughput regression; 100 Mbps payload and sub-1 ms targets remain unmet. The
optimization comparison is documented in
[`docs/nat-performance-optimization-20260807.md`](docs/nat-performance-optimization-20260807.md).
Raw test output is shipped with the delivery archive rather than treated as a
release gate.
The image includes the Misectel-styled `System > Upgrade` page for authenticated
firmware upload, device compatibility validation, SHA-256 review, optional
configuration preservation, confirmation, and automatic reconnect after
sysupgrade.
Before first-run setup completes, the gateway overrides the board-generated
DHCP WAN with static `192.168.1.1/24`, so management login does not require an
upstream DHCP server. Upgrades preserve the selected WAN configuration after
setup completion.

ImmortalWrt is a fork of [OpenWrt](https://openwrt.org), with more packages ported, more devices supported, default optimized profiles and localization modifications for mainland China users.<br/>
Compared to upstream, we allow to use (non-upstreamable) modifications/hacks to provide better feature/performance/support.

Default login address: http://192.168.1.1 or http://immortalwrt.lan, username: __root__, password: _none_.

## Download
Built firmware images are available for many architectures and come with a package selection to be used as WiFi home router. To quickly find a factory image usable to migrate from a vendor stock firmware to ImmortalWrt, try the *Firmware Selector*.

- [ImmortalWrt Firmware Selector](https://firmware-selector.immortalwrt.org/)

If your device is supported, please follow the **Info** link to see install instructions or consult the support resources listed below.

## Development
To build your own firmware you need a GNU/Linux, BSD or macOS system (case sensitive filesystem required). Cygwin is unsupported because of the lack of a case sensitive file system.<br/>

  ### Requirements
  To build with this project, Debian 11 is preferred. And you need use the CPU based on AMD64 architecture, with at least 4GB RAM and 25 GB available disk space. Make sure the __Internet__ is accessible.

  The following tools are needed to compile ImmortalWrt, the package names vary between distributions.

  - Here is an example for Debian/Ubuntu users:<br/>
    - Method 1:
      <details>
        <summary>Setup dependencies via APT</summary>

        ```bash
        sudo apt update -y
        sudo apt full-upgrade -y
        sudo apt install -y ack antlr3 asciidoc autoconf automake autopoint binutils bison build-essential \
          bzip2 ccache clang cmake cpio curl device-tree-compiler ecj fastjar flex gawk gettext gcc-multilib \
          g++-multilib git gnutls-dev gperf haveged help2man intltool lib32gcc-s1 libc6-dev-i386 libelf-dev \
          libglib2.0-dev libgmp3-dev libltdl-dev libmpc-dev libmpfr-dev libncurses-dev libpython3-dev \
          libreadline-dev libssl-dev libtool libyaml-dev libz-dev lld llvm lrzsz mkisofs msmtp nano \
          ninja-build p7zip p7zip-full patch pkgconf python3 python3-pip python3-ply python3-docutils \
          python3-pyelftools qemu-utils re2c rsync scons squashfs-tools subversion swig texinfo uglifyjs \
          upx-ucl unzip vim wget xmlto xxd zlib1g-dev zstd
        ```
      </details>
    - Method 2:
      ```bash
      sudo bash -c 'bash <(curl -s https://build-scripts.immortalwrt.org/init_build_environment.sh)'
      ```

  Note:
  - Do everything as an unprivileged user, not root, without sudo.
  - Using CPUs based on other architectures should be fine to compile ImmortalWrt, but more hacks are needed - No warranty at all.
  - You must __not__ have spaces or non-ascii characters in PATH or in the work folders on the drive.
  - If you're using Windows Subsystem for Linux (or WSL), removing Windows folders from PATH is required, please see [Build system setup WSL](https://openwrt.org/docs/guide-developer/build-system/wsl) documentation.
  - Using macOS as the host build OS is __not__ recommended. No warranty at all. You can get tips from [Build system setup macOS](https://openwrt.org/docs/guide-developer/build-system/buildroot.exigence.macosx) documentation.
  - For more details, please see [Build system setup](https://openwrt.org/docs/guide-developer/build-system/install-buildsystem) documentation.

  ### Quickstart
  1. Run `git clone -b <branch> --single-branch --filter=blob:none https://github.com/immortalwrt/immortalwrt` to clone the source code.
  2. Run `cd immortalwrt` to enter source directory.
  3. Run `./scripts/feeds update -a` to obtain all the latest package definitions defined in feeds.conf / feeds.conf.default
  4. Run `./scripts/feeds install -a` to install symlinks for all obtained packages into package/feeds/
  5. Run `make menuconfig` to select your preferred configuration for the toolchain, target system & firmware packages.
  6. Run `make` to build your firmware. This will download all sources, build the cross-compile toolchain and then cross-compile the GNU/Linux kernel & all chosen applications for your target system.

  ### Related Repositories
  The main repository uses multiple sub-repositories to manage packages of different categories. All packages are installed via the OpenWrt package manager called opkg. If you're looking to develop the web interface or port packages to ImmortalWrt, please find the fitting repository below.
  - [LuCI Web Interface](https://github.com/immortalwrt/luci): Modern and modular interface to control the device via a web browser.
  - [ImmortalWrt Packages](https://github.com/immortalwrt/packages): Community repository of ported packages.
  - [OpenWrt Routing](https://github.com/openwrt/routing): Packages specifically focused on (mesh) routing.
  - [OpenWrt Video](https://github.com/openwrt/video): Packages specifically focused on display servers and clients (Xorg and Wayland).

## Support Information
For a list of supported devices see the [OpenWrt Hardware Database](https://openwrt.org/supported_devices)
  ### Documentation
  - [Quick Start Guide](https://openwrt.org/docs/guide-quick-start/start)
  - [User Guide](https://openwrt.org/docs/guide-user/start)
  - [Developer Documentation](https://openwrt.org/docs/guide-developer/start)
  - [Technical Reference](https://openwrt.org/docs/techref/start)

  ### Support Community
  - Support Chat: group [@ctcgfw_openwrt_discuss](https://t.me/ctcgfw_openwrt_discuss) on [Telegram](https://telegram.org/).
  - Support Chat: group [#immortalwrt](https://matrix.to/#/#immortalwrt:matrix.org) on [Matrix](https://matrix.org/).

## License
ImmortalWrt is licensed under [GPL-2.0-only](https://spdx.org/licenses/GPL-2.0-only.html).

## Acknowledgements
<table>
  <tr>
    <td><a href="https://dlercloud.com/"><img src="https://user-images.githubusercontent.com/22235437/111103249-f9ec6e00-8588-11eb-9bfc-67cc55574555.png" width="183" height="52" border="0" alt="Dler Cloud"></a></td>
    <td><a href="https://www.jetbrains.com/"><img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_square.png" width="120" height="120" border="0" alt="JetBrains Black Box Logo logo"></a></td>
    <td><a href="https://sourceforge.net/"><img src="https://sourceforge.net/sflogo.php?type=17&group_id=3663829" alt="SourceForge" width=200></a></td>
  </tr>
</table>
