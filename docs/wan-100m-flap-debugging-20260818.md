# WAN 100M 全双工链路开机抖动 — 调试过程与结论

日期：2026-08-18
设备：Misectel 7621EVB（MT7621，4 线 / 100BASE-TX only）
对象：wan 口（switch0 port@0，GPHY 0）

---

## 1. 问题现象

- 开机后 wan 口周期性掉线：`Link is Up - 100Mbps/Full`（约 0.4s）→ `Link is Down`（约 14s），无限循环。
- 同一片 GPHY 的 LAN 口（port@1/2）**秒稳**，不抖。
- 手动执行 `ifdown wan && ifup wan`（或 `ip link set wan down && ip link set wan up`）**在开机约 5 分钟之后**能彻底稳定（之后 0 次掉线）。
- 开机后马上做同样的操作（约 40~67s）**无效**，抖继续。

## 2. 环境 / 拓扑

- wan 接对端交换机（用户确认与 PVE 无关）。
- LAN1/LAN2 接 USB 网卡或交换机，稳定。
- 串口：`/dev/ttyCH343USB0` 115200 8N1；SSH 不可用；刷机走 wan 下载固件。
- MDIO 总线：`mdio-bus`（GPHY 0-4 + 交换机 0x1f）、`mt7530-0`（内部 PHY 0-4）。

## 3. 调试时间线（摘要）

1. 700（GPHY DSP 0x123/0xa6）与 701（switch init）补丁已入镜像，抖动仍在。
2. 手动 `mdio mdio-bus 0 0x0 0x1200`（BMCR 重新自协商）能"稳定"（19→6 Down/90s），一度以为是重新自协商。
3. 反复对比后确认：**只有完整 phylink stop/start（`ip link down/up`）是确定性修复**，且只在 ~5 分钟后有效。
4. 寄存器快照对比（boot 抖动态 vs 稳定态）发现若干差异（0xa6、0x122、多个 0x0800 位），逐一排查。
5. 逐项做了大量寄存器实验（详见第 4 节），全部不能缩短 ~5 分钟窗口。
6. 网上调研确认这是 OpenWrt 已知问题（见第 5 节）。

## 4. 假设与验证

### 4.1 假设：700 DSP 调优是修复 → **被否决（且发现 700 有 bug）**

- 验证：读 MMD 寄存器发现 DSP 寄存器 0x123/0xa6 实际在 **VEND1（0x1e）**，而 700 补丁写的是 **VEND2（0x1f）**。
  - `port0 VEND1: 0x123=0xffff 0xa6=0x03e0`（正确值）
  - `port0 VEND2: 0x123=0x0000 0xa6=0x0000`（空，700 写了个寂寞）
- 结论：700 一直是 no-op（写错 MMD），"700 修复"从一开始就不存在。

### 4.2 假设：701 switch init 是修复 → **被否决**

- 701 相关寄存器（TCK_CTRL=0x855、P6ECR、TRGMII_TXCTRL、TD_ODT=0x44）开机后均已生效，寄存器值与抖动无关。

### 4.3 假设：MCC（0xa6）被 switch reset 清掉是主因 → **被否决**

- 快照对比：boot 态 `0xa6=0x0000`，稳定态 `0xa6=0x03e0`（config_init 在 switch reset 前写入，被 reset 清掉）。
- 验证：开机后（甚至首链路建立前）手动补写 `0xa6=0x0300`，抖依旧。→ 0xa6 不是主因。

### 4.4 假设：4 线 + 千兆广播导致自协商死循环 → **被否决**

- 验证：DTS 加 `max-speed = <100>`（PHY 不再广播 1000baseT，`ethtool` 确认只广播 10M/100M），抖依旧（~0.2/s）。
- 更强证据：`ethtool -s wan speed 100 duplex full autoneg off`（强制 100M、关闭自协商）**也照样抖** → 证明与自协商/千兆广播无关。

### 4.5 假设：EEE 初始化时序 → **确认是根因**

- 早期误判：运行时 `ethtool --show-eee wan` 显示 disabled，且 DTS 已有
  `eee-broken-100tx`/`eee-broken-1000t`，因此一度排除 EEE。
- 关键区别：这些限制由通用 PHY 层在 PHY attach/config_init 阶段应用，晚于
  MT7530 switch setup 和 PHY 的首次硬件状态；运行时 disabled 不能证明首次
  attach 前未广播过 EEE。
- 修复：在 `mt7530_setup()` 中、`mt753x_trap_frames()` 和首次 PHY attach 之前，
  对 MT7621 的五个集成 PHY 清零 `MDIO_MMD_AN/MDIO_AN_EEE_ADV`。
- Phase A 实机：WAN 在 `60.495s` 首次 Link Up，直到 300 秒 workaround 于
  `361.725s` 主动 Link Down，连续约 301 秒没有异常掉线；随后在 `375.499s`
  恢复 100Mbps/Full。与旧固件每 1-3 秒掉线形成直接对照。

### 4.6 假设：downshift 反复降速导致掉线 → **被否决**

- 验证：清 downshift 位（page1 reg0x14 bit4）无效。

### 4.7 假设：MASTER DSP ready time 缺失（MT798x 驱动会同时设 slave+master，MT7621 只设 slave）→ **被否决**

- 验证：设 `MASTER_DSP_READY_TIME = 0x5e`（与 slave 对齐），抖依旧。

### 4.8 各种"重新自协商 / 电源循环"类操作 → **均不足以修复**

| 操作 | 结果 |
|---|---|
| BMCR ANENABLE\|ANRESTART（0x1200） | 部分缓解（~0.06/s），不彻底 |
| BMCR PDOWN 0x0800→0x1200 | 无效 |
| 干净电源循环 0x1800→0x1000 | ~395s 时有效、~67s 时无效（时间相关） |
| ANAR+BMCR、reg9=0、全序列 | 无效 |
| 驱动级 `phy_stop`/`phy_start`（延时 work） | 无效（不等价于完整 `ip link down/up`） |

### 4.9 临时 workaround（已由内核修复取代）

`ip link set wan down && ip link set wan up`（完整 phylink stop/start），但**只在开机 ~5 分钟后有效**（~40-67s 无效，~283s+ 有效，~10 分钟有效）。

该方案曾固化为开机脚本，在 Phase A 中仅用于建立对照边界。早期 EEE
初始化修复已使首次 Link Up 后保持稳定，最终实现删除该脚本。

## 5. 网上调研（OpenWrt 已知问题）

- [openwrt/openwrt#24752](https://github.com/openwrt/openwrt/issues/24752)（2026-08-15）：同类 MT7621/MT7530 100M 启动抖动，重启 network 后恢复。
- [openwrt/openwrt#22647](https://github.com/openwrt/openwrt/pull/22647)：在 MT7621 switch setup 早期清除全部集成 PHY 的 EEE 广告；本设备采用该修复并通过 Phase A 实机验证。
- [openwrt/openwrt#17351](https://github.com/openwrt/openwrt/issues/17351) + [openwrt-devel 邮件](https://lists.openwrt.org/pipermail/openwrt-devel/2025-April/043936.html)：MT7530 内部 GPHY 的 EEE IOT 问题背景。

## 6. 推测与思路演变

1. **早期思路**：以为是某个"调优项"（700 DSP / 701 switch init）没写对 → 结果发现 700 写错 MMD、701 已生效，都不是。
2. **中期思路**：以为是"重新自协商"能救 → 反复对比发现纯寄存器重协商不充分，必须是完整 phylink stop/start。
3. **寄存器快照思路**：想找出 boot 态与稳定态的差异寄存器，定位"被 reset 清掉的关键值" → 找到 0xa6，但补写不修复，说明只是表象。
4. **自协商思路**：怀疑 4 线 + 千兆广播死循环 → `max-speed` 与 `autoneg off` 都证明与自协商无关。
5. **最终定位**：运行时的 EEE disabled 只描述 PHY attach 之后的状态，不能覆盖
   switch setup 到首次 attach 之间的窗口。将 EEE 广告清零提前到
   `mt7530_setup()` 后，WAN 从首次 Link Up 即稳定，否定了“五分钟 DSP 收敛”推测。

## 7. 当前结论

1. 根因是 MT7621 集成交换机 PHY 的 **EEE 广告关闭得太晚**；DTS broken-EEE
   标志和运行时 `ethtool` 状态不能阻止首次 attach 前的硬件广告窗口。
2. 在 `mt7530_setup()` 早期清零 `MDIO_AN_EEE_ADV` 后，WAN 首次协商即稳定。
3. 700 写错 MMD（VEND2 0x1f，而寄存器位于 VEND1 0x1e），且实测无效；
   701 修改 CPU/P5/TRGMII 路径，与单个用户 PHY carrier 抖动无因果关系。
4. `max-speed = <100>`、强制 100M、DSP 调参和 300 秒重置脚本均不需要。

## 8. 最终镜像实机验证

1. 首次刷入最终精简镜像后，WAN 在 `62.380s` Link Up，观察约 3 分钟无
   Link Down；链路为 100Mbps/Full，EEE 广告寄存器为 `0x0000`。
2. 连续两次热启动均未复现抖动；第一次热启动在 `37.310s` Link Up，后续
   观察窗口内无 Link Down，第二次热启动结果相同。
3. 断电超过 10 秒后冷启动，串口确认重新经过 U-Boot SPL 和完整内核启动。
   WAN 在 `37.092s` Link Up，持续观察 6 分钟（跨过旧 workaround 的 300 秒
   执行点）仅有这一次链路事件。
4. 冷启动最终状态为 100Mbps/Full、自动协商开启、Link detected；
   `MDIO_AN_EEE_ADV = 0x0000`，WAN RX/TX error、drop、carrier 和 collision
   计数均为 0。

最终精简镜像不依赖 700/701、DTS 限速或 300 秒重置脚本，代码级修复通过
首次启动、两次热启动和一次断电冷启动验证。
