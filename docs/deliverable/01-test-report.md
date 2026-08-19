# 7621 vrf evb 测试报告

本机名称：`7621 vrf evb`（board_name `misectel,7621evb`，产品型号 NEX905-F-40）
固件：ImmortalWrt 25.12-SNAPSHOT `r37896-45f33e0f05`，内核 6.12.85
测试日期：2026-08-14（本报告汇总 2026-08-03 至 2026-08-14 各轮实测结果）
测试用例基线：`docs/deliverable/testcases/`（按 SRS 第 4 章拆分，共 86 条 / 21 个模块）

## 1. 测试结论摘要

| 维度 | 结果 |
| --- | --- |
| 需求设计覆盖 | 86/86（100%） |
| 已实机验证并记录证据 | 见 §3 |
| 验证通过（核心链路） | 登录、Web 配置、VRF NAT、组播 NAT、SNMP、安全策略、二层转发 |
| 未通过/受阻 | NAT 性能（100Mbps / <1ms）、RTC（无 ACK） |
| 待补测 | 30*24H 长稳、异常掉电、32M 升级断电回滚、QoS（未实现） |

## 2. 测试环境

| 项 | 值 |
| --- | --- |
| 设备 | Misectel 7621EVB NAT Gateway（MT7621），256 MiB DDR3，16 MiB SPI NOR |
| 管理地址 | `https://192.168.1.1`（WAN 静态，出厂态） |
| 登录 | `root` / `Admin@12345678` |
| 测试主机 | Linux `enp6s18`（10.96.210.226/24），RTL8152 USB 网卡 ×2（LAN1/LAN2） |
| 串口 | `/dev/ttyCH343USB0`（115200 8N1） |
| 工具 | Playwright 1.62.1、Net-SNMP、iperf3、lldpcli、抓包工具 |

## 3. 已执行测试详细结果

### 3.1 标准协议与启动

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| STD-002 100BaseT(X) | PASS | WAN/LAN 协商 100Mbps 全双工 |
| BOOT-001 上电到可 Ping ≤30s | FAIL | 实测 38.67 / 53 秒，未达目标 |

### 3.2 MAC / 端口 / 二层

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| MAC-006 MAC 查询 | PASS | `bridge fdb` 与 `misectel.switch get_macs` 返回一致 |
| MAC-004/MAC-005 白/黑名单 | PASS | 安全策略验证经 RPC 通过 |
| PORT-001 速率/双工 | PASS | WAN/LAN2 稳定 100Mbps 全双工 |
| PORT-010 端口状态 | **PASS（复测）** | WAN/LAN2 均 up、100Mbps、full、carrier=1；`get_ports` 回读一致；事件仅 lldp_change/new_mac，0 次 link_up/down；rx/tx 计数递增、rx_errors/crc_errors 均为 0（前轮 LAN2 119 次、WAN 291 次链路抖动已消失） |
| PORT-009 link/activity 灯 | 待补 | 未专项记录 |
| PORT-006 风暴抑制 | PASS | tc ingress policer 实机临时策略验证并恢复 |

### 3.3 SNMP / LLDP（2026-08-14 完整重跑）

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| SNMP-001 Get | PASS | `sysObjectID.0=1.3.6.1.4.1.62446.6.1.905.1`；`sysName.0=7621 vrf evb`；`sysDescr.0=Linux 7621 vrf evb 6.12.85`；`sysLocation.0=Suzhou`；`sysContact.0=Inovance NEX905` |
| SNMP-001 GetNext/Walk | PASS | ENTITY-MIB `entPhysicalTable`（chassis NEX905-F-40 + wan/lan1-4）；BRIDGE-MIB `dot1dBaseBridgeAddress=02 76 21 00 03 E9`；LLDP-MIB `lldpLocSysName=7621 vrf evb`、`lldpRemSysName=LLDP-TEST-HOST` |
| SNMP-001 Set（sysName/sysContact/sysLocation） | **PASS（已修复）** | v2c/v3 authPriv 均写入成功并回读一致；修复方式：snmpd.conf 由 `sys*`（只读）改为 `psys*`（持久可写）指令 |
| SNMP-001 反向只读 | PASS | `sysDescr.0`/`sysObjectID.0` Set 返回 `noAccess`（只读保护正确） |
| SNMP-001 SNMPv3 authPriv | PASS | SHA-256/AES-256 查询 `sysName.0` 通过；错误口令返回 Authentication failure |
| LLDP-002 邻居发现（docker 模拟） | PASS | 本机 docker 运行 lldpd（host 网络）向 WAN 发送 LLDP；设备 `lldpStatsRxPortFramesTotal(wan)` 递增、`lldpRemSysName=LLDP-TEST-HOST`、`get_topology` 返回完整邻居 |
| LLDP-003 LLDP MIB | PASS | `lldpLocTable`/`lldpRemTable` 经 AgentX 可查 |
| LLDP 邻居（真实第三方设备） | 待补 | 无真实邻居，仅 docker 模拟 |

### 3.4 网络安全

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| SEC-001 DoS/DDoS | PASS（monitor 模式） | 七类防护以 monitor 模式原子应用 |
| SEC-002 ARP/DHCP 防御 | PASS | IP-MAC 绑定 + 伪 DHCP 阻断验证 |
| IP-002 防欺骗 | PASS | 静态 ARP/IP-MAC 绑定创建、应用、分页查询、邻居计数通过 |
| ARP-003 Proxy ARP | PASS | VRF1 启用并回读状态 |
| ACL-003 端口重定向 | PASS | 同端口环路被 HTTP 400 拒绝 |

### 3.5 NAT / DHCP / 组播

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| NAT-001 WAN/LAN 不互通 | PASS | 出厂无默认路由/转发 |
| NAT-006 双向 1:1 | PASS | VRF2 host 映射 ICMP/HTTP 双向 |
| NAT-007 多产线重复 IP | PASS | 两 VRF 相同地址并发隔离 |
| NAT-009 Ethernet/IP 组播 NAT | PASS | WAN `239.20.20.20` ↔ VRF1 `239.10.10.10` 双向改写 + SNAT |
| NAT-002 时延 <1ms | FAIL | 平均 1.222ms |
| NAT-003 带宽 100Mbps / ≥15Kpps | PARTIAL | 15Kpps 通过（15134.87pps）；正/反向 94.78/94.76Mbps 未达 |
| DHCP-002 每 VRF DHCP Server | PASS | VRF2/LAN2 静态租约、网关、DNS、重载恢复 |
| DHCP-001 WAN DHCP Client | 待补 | 页面已支持，未专项实测 |

### 3.6 系统 / Web / 可靠性

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| WEB-004 登录认证 | PASS | root HTTPS 登录成功 |
| WEB-003 TLS 1.2/1.3 | PASS | 两个版本均握手验证 |
| WEB-006 功能配置（Playwright 实机） | PASS | 主机名 `7621 vrf evb`、NAT 映射增删、IP-MAC 绑定新增、LLDP 系统名均经 Web 配置并落盘（RPC/SNMP 回读一致） |
| IP-001 设备管理 IP/本机名称 | PASS | 主机名经 Web 配置为 `7621 vrf evb`，SNMP `sysName.0=7621 vrf evb` |
| SYS-002 恢复出厂 | PASS | 恢复默认并重新生成证书 |
| WEB-005 固件升级 | PASS | 上传、型号/SHA-256 校验、保留配置升级 |
| CLI-001 SSHv2 | PARTIAL | 厂家调试可用；本轮实机 SSH 22 端口被拒（安全策略默认关闭，需按策略开启后复测） |
| REL-004 自恢复 | PASS（设计） | procd/watchdog；panic 重启专项待补 |
| REL-001 30*24H | 待补 | 未执行长稳 |
| REL-005 异常掉电 | 待补 | 未执行 |
| OPS-001 升级断电回滚 | 待补（32M 变体） | 设计已实现，硬件验证待跑 |

## 4. 未执行 / 待验证清单

- QoS 模块 6 条（未实现，不进入执行）。
- MDIX、端口镜像、VLAN 优先级转发、NTP 鉴权（未实现）。
- RTC 本地时钟（受阻：PCF85063AT I2C `0x51` 无 ACK）。
- 30*24H 长稳、大量 ARP 冲击、内存泄漏、异常掉电、异常配置导入、WEB/SNMP/CLI 并发配置、32M 升级断电回滚、WAN DHCP Client、1024 条满表。
- NAT ALG FTP 完整协议验收、OPC UA PubSub 端到端。

## 5. 遗留问题

1. **NAT 性能未达标**：100Mbps 吞吐与 <1ms 时延未达门槛（实测 94.78/94.76Mbps、1.222ms）。
2. **RTC 无应答**：PCF85063AT 实机 `0x51` 无 ACK，驱动返回 `-145`，需硬件排查（供电/上拉/走线）。
3. **IP-MAC 绑定表格操作按钮渲染缺陷**：安全页绑定列表的 Edit/Delete 按钮渲染为 `[object HTMLDivElement]` 文本（`ui.js` 的 `td()` 对非数组节点执行 `String()`），后端 `delete_binding` RPC 正常。
4. **首页 ACL 警告**：dashboard 出现非致命 `uci/get -32002 Access denied`（`luci-app-misectel-dashboard` ACL 缺 `uci` 读权限）。
5. **SNMP-TARGET-MIB 未注册**：`snmpTargetAddrTable` 返回 No Such Object，需排查模块 gating。
6. **启动时间超标**：上电到可 Ping 实测 38.67/53 秒，超 30 秒目标。
7. **LAN2/WAN 链路抖动（已解决）**：前轮 LAN2（119 次）、WAN（291 次）链路抖动本轮复测已消失，两者均稳定 100Mbps 全双工、0 次 link_up/down、0 错误计数。

## 6. 本次实现说明（SNMP Set）

- 根因：net-snmp `system_mib` 对 `sysName/sysContact/sysLocation` 的处理中，snmpd.conf 使用
  `sysLocation`/`sysContact`/`sysName`（非持久）指令时，`system_parse_config_string` 将
  `guard` 置为 `-1`，`handle_updates` 检测到 `*set < 0` 即对 SET 返回 `notWritable`，使三个
  管理标签变为只读。
- 修复：`feeds/packages/net/net-snmp/files/snmpd.init` 的 `snmpd_system_add` 改用
  `psysLocation`/`psysContact`/`psysName`（持久）指令，`guard` 置为 `1`，三个标签保持可写。
- 回归：v2c 与 v3 authPriv 对三个标签 Set 均成功并回读一致；只读对象（sysDescr/sysObjectID）
  Set 仍返回 `noAccess`；错误口令返回 Authentication failure。

完整测试用例定义见 `docs/deliverable/testcases/`；Web 验证细节与截图见
[`02-delivery-instruction.md`](02-delivery-instruction.md)。
