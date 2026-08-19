# NEX905-F-40 发板测试报告（第二轮，修复后复测）

测试日期：2026-08-13（第二轮）
设备：`misectel,7621evb`（16MB，单分区），串口 `/dev/ttyCH343USB0`
固件：ImmortalWrt `r37884+10-2f19f2b9cb`，`misectel-switch-manager`（含 pass_persist 修复）
测试主机：`enp6s18`（10.96.210.226/24）；两个 USB 网卡（RTL8152）接入 LAN1/LAN2

## 1. 测试结论

首轮发现的 2 个 pass_persist 缺陷（BRIDGE-MIB 值解析、ENTITY-MIB 排序）及前导点
问题均已修复并实机验证通过。SNMP 核心能力（企业 OID / SNMP Set / SNMPv3 /
BRIDGE-MIB / ENTITY-MIB）全部通过。本轮新增 LAN2 端口链路抖动（物理连接问题），
导致 LAN1↔LAN2 二层转发本轮无法复测。

| 大项 | 结果 |
| --- | --- |
| 系统启动 | PASS |
| 端口 link 检测（LAN1） | PASS |
| 端口 link 检测（LAN2） | **FAIL（抖动，物理问题）** |
| MAC 学习 | PASS |
| 交换机管理 ubus API | PASS |
| SNMP（企业 OID / Set / v3 / BRIDGE-MIB / ENTITY-MIB） | **PASS（含上轮修复）** |
| LLDP | PASS（无邻居） |
| L2 转发（LAN1↔LAN2） | **本轮无法测（LAN2 抖动）** |
| WAN 链路稳定性 | **FAIL（抖动，环境问题）** |

## 2. 详细结果

### 2.1 系统启动

`DISTRIB_REVISION=r37884+10-2f19f2b9cb`，内核 `6.12.85`，分区布局正确（16MB 单
`firmware`）。运行 38 分钟无异常。

### 2.2 端口 link 检测

| 端口 | carrier | 速率 | 双工 | 备注 |
| --- | --- | --- | --- | --- |
| wan | 1 | 100 Mbps | full | 链路抖动（见 §3.3） |
| lan1（USB 网卡 1） | 1 | 100 Mbps | full | 稳定 |
| lan2（USB 网卡 2） | 0 | - | - | 链路抖动，无稳定 link |
| lan3 | 0 | - | - | 无网线 |
| lan4 | 0 | - | - | 无网线 |

### 2.3 MAC 学习

桥接 LAN1 后，USB 网卡 1 的 MAC 正确学习到 lan1：

- `bridge fdb`：`00:e0:3b:83:21:3f dev lan1`
- `misectel.switch get_macs`：`total: 1`，`mac=00:e0:3b:83:21:3f, port=lan1`

### 2.4 交换机管理 ubus API

`misectel.switch` 的 `capabilities`（api_version=1、max_mac_per_port=64）、
`get_status`（watcher_running=true、lldp_running=true）、`get_macs` 均正常。

### 2.5 SNMP（上轮修复全部实机复测通过）

| 项 | 结果 | 说明 |
| --- | --- | --- |
| sysObjectID.0 | PASS | `enterprises.62446.6.1.905.1`（企业 OID） |
| dot1dBaseBridgeAddress.0 | PASS | `Hex-STRING: 02 76 21 00 03 E9`（VRF 桥 MAC，映射修正） |
| SNMP Set sysLocation | PASS | 写入 `BoardTest-RoomA` |
| SNMP Set sysDescr（应拒绝） | PASS | `noAccess`（只读保护正确） |
| SNMPv3 authPriv 查询 | PASS | `sysName.0 = ImmortalWrt`（SHA-256/AES-256） |
| entPhysicalTable | PASS | 31 行完整表，顺序正确（chassis=index1 + wan/lan1-4=index2-6） |

## 3. 发现的问题

### 3.1 LAN2 链路抖动（本轮新增，物理问题）

LAN2 端口链路反复 UP/DOWN，累计 119 次（约每 2-3 秒一次），两端（设备 MT7530
LAN2 PHY 与 USB 网卡 2）均无法稳定协商。首轮测试 LAN2 稳定 100Mbps，本轮出现
抖动，疑似 USB 网卡 2 物理连接/线缆问题（该网卡在首轮被移入 netns 后复位过）。
已尝试强制 100Mbps 全双工，仍无法稳定。需检查线缆与 USB 网卡 2 的物理连接。

### 3.2 WAN 链路抖动（环境问题，持续存在）

WAN 口累计 291 次 UP/DOWN（约每 8 秒一次，UP 约 0.2s/DOWN 约 14s），100Mbps。
疑似上游交换机 STP/环路保护或线缆问题，非设备固件问题（U-Boot/固件侧 PHY 正常，
强制速率后仍抖动）。该问题不影响 LAN 侧测试与 SNMP（走 localhost）。

### 3.3 SNMP-TARGET-MIB 未暴露（缺口，待排查）

`snmpTargetAddrTable`（`.1.3.6.1.6.3.12.1.2`）返回 `No Such Object`。`target` 模块
已编入 net-snmp，但运行时未注册该表，需排查模块初始化 gating 或依赖。

### 3.4 LLDP 空邻居条目（小问题）

`get_topology` 返回一个空 `{}` 邻居条目（`lldpcli` 显示无邻居），为管理器
lldpData() 对空结果的处理瑕疵。

## 4. 清理

- 设备：删除临时 `br-test` 桥；SNMP 恢复 `disabled`（snmpd 停止）；LAN2 autoneg 恢复。
- 主机：临时 IP / HTTP 服务 / USB 测试 IP 已清理。

## 5. 待办

1. LAN2 物理连接排查（换线/检查 USB 网卡 2），恢复后补测 LAN1↔LAN2 二层转发。
2. 排查 SNMP-TARGET-MIB 运行时未注册的问题。
3. WAN 链路抖动需硬件排查（上游交换机端口 STP/端口安全/线缆）。
4. 修正 get_topology 空邻居条目。
