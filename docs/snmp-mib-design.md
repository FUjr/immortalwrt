# NAT 交换机 NEX905-F-40 SNMP MIB 设计文档

项目：设备级网络解决方案 V1R1（CH26010012）
设备：`misectel,7621evb` / `misectel,7621evb-32m`
拟制：钟伟峰　日期：2026-08-07（V1.0 新制定）

## 1 文档目的

本文档定义 NAT 交换机 NEX905-F-40 的 SNMP MIB 对象，作为软件开发与测试的依据。
设备基于 Net-SNMP 5.9.4（SSL 变体）代理，`lldpd` 通过 AgentX 提供链路发现数据。

SNMP 版本：v1 / v2c / v3，支持 Get / GetNext / Set / BulkGet。默认关闭 v1，生产环境
要求关闭 v1/v2c、仅保留 SNMPv3（`SHA-256` 认证 + `AES-256` 加密）。

## 2 公共 MIB

### 2.1 系统信息（system，RFC 3418 SNMPv2-MIB）

节点路径：`iso(1).org(3).dod(6).internet(1).mgmt(2).mib-2(1).system(1)`。

| 名称 | OID | 类型 | 属性 | 说明 |
| --- | --- | --- | --- | --- |
| sysDescr | `.1.3.6.1.2.1.1.1` | DisplayString | 只读 | 设备完整描述，含硬件型号、操作系统、网络软件，0～255 |
| sysObjectID | `.1.3.6.1.2.1.1.2` | Object Identifier | 只读 | 设备厂商/型号 OID，见 2.1.1 |
| sysUpTime | `.1.3.6.1.2.1.1.3` | Timeticks | 只读 | 网管子系统运行时间，1/100 秒 |
| sysContact | `.1.3.6.1.2.1.1.4` | DisplayString | **读写** | 设备联系人（姓名/邮箱/电话） |
| sysName | `.1.3.6.1.2.1.1.5` | DisplayString | **读写** | 设备名称（FQDN），建议 ASCII |
| sysLocation | `.1.3.6.1.2.1.1.6` | DisplayString | **读写** | 设备物理位置 |
| sysServices | `.1.3.6.1.2.1.1.7` | INTEGER | 只读 | OSI 服务层级，本设备为二层交换，取值 2 |

实现说明：`sysDescr`/`sysObjectID`/`sysUpTime`/`sysServices` 由 Net-SNMP
`mibII/system_mib` 提供；`sysContact`/`sysName`/`sysLocation` 为读写对象，通过
VACM 写视图开放（见 §4）。三个标签由 Web 管理页和 SNMP Set 共同维护，Set 后通过
Net-SNMP 持久化机制（`psyscontact`/`psysname`/`psyslocation`）保存。

#### 2.1.1 sysObjectID 规范

- 汇川企业 PEN：`62446`，根 OID `1.3.6.1.4.1.62446`。
- 产品线.产品类型.产品系列.产品型号 编码：`6.1.905.1`。
- 本设备 `sysObjectID.0 = 1.3.6.1.4.1.62446.6.1.905.1`。

### 2.2 设备 MAC 地址（BRIDGE-MIB，RFC 4188）

节点路径：`...mib-2(1).dot1dBridge(17)`。

| 名称 | OID | 类型 | 属性 | 说明 |
| --- | --- | --- | --- | --- |
| dot1dBaseBridgeAddress | `.1.3.6.1.2.1.17.1.1` | MacAddress | 只读 | 设备 L2 桥 MAC，取 VRF 桥接口 MAC |

实现说明：Net-SNMP 不内置 BRIDGE-MIB，由 `pass_persist` 扩展提供（见 §4.2）。
`dot1dBaseBridgeAddress` 映射到 VRF 桥接口：优先读取实际 `br-vrf1` 的 MAC；VRF
未创建（出厂态）时按 `misectel-vrf-apply bridge_mac()` 规则由 WAN MAC + 路由表号
派生（首个 VRF，表号 1001），即 `(WAN[0]|2)&254 : WAN[1:3] : 03 : e9`，与
`br-vrf1` 实际地址一致。

### 2.3 物理实体详细描述（entPhysicalTable，ENTITY-MIB RFC 4133/6933）

节点路径：`...mib-2(1).entityMIB(47).entPhysicalTable(1.1.1.1)`。

| 名称 | OID 后缀 | 类型 | 属性 | 说明 |
| --- | --- | --- | --- | --- |
| entPhysicalIndex | `.1` | PhysicalIndex | 只读 key | 实体唯一索引，重启前后不变 |
| entPhysicalDescr | `.2` | SnmpAdminString | 只读 | 设备型号、板卡、接口描述 |
| entPhysicalClass | `.5` | PhysicalClass | 只读 | 枚举：chassis(3)/port(10)/… |
| entPhysicalName | `.7` | SnmpAdminString | 只读 | 实体名称，如 "Slot 1"、"GigabitEthernet0/1" |
| entPhysicalHardwareRev | `.8` | SnmpAdminString | 只读 | 硬件版本号 |
| entPhysicalSoftwareRev | `.10` | SnmpAdminString | 只读 | 软件版本号 |
| entPhysicalSerialNum | `.11` | SnmpAdminString | 只读 | 出厂序列号 |
| entPhysicalMfgName | `.12` | SnmpAdminString | 只读 | 厂商名称，示例 "Inovance" |
| entPhysicalModelName | `.13` | SnmpAdminString | 只读 | 型号，示例 "NEX905-F-40" |

实现说明：`entPhysicalClass` 定义为 `chassis(3)`，供网管获取设备基础信息；物理端口
（WAN/LAN1-4）以 `port(10)` 列出。由 `pass_persist` 扩展提供（见 §4.2）。

### 2.4 LLDP（LLDP-V2-MIB，IEEE 802.1AB-2009）

#### 2.4.1 本地端口信息表 lldpV2LocPortTable

节点路径：`iso(1).org(3).ieee(111).standards(2).lan-man-stds(802).ieee802dot1(1).
ieee802dot1mibs(1).lldpV2MIB(13).lldpV2Objects(1).lldpV2LocalSystemData(3).
lldpV2LocPortTable(7).lldpV2LocPortEntry(1)`，索引 `lldpV2LocPortIfIndex`。

| 名称 | OID | 类型 | 属性 |
| --- | --- | --- | --- |
| lldpV2LocPortIfIndex | `.1.3.111.2.802.1.1.13.1.3.7.1.1` | InterfaceIndex | not-accessible key |
| lldpV2LocPortIdSubtype | `.1.3.111.2.802.1.1.13.1.3.7.1.2` | LldpV2PortIdSubtype | 只读 |
| lldpV2LocPortId | `.1.3.111.2.802.1.1.13.1.3.7.1.3` | LldpV2PortId | 只读 |
| lldpV2LocPortDesc | `.1.3.111.2.802.1.1.13.1.3.7.1.4` | SnmpAdminString | 只读 |

#### 2.4.2 远端邻居信息表 lldpV2RemTable

索引：`lldpV2RemTimeMark`、`lldpV2RemLocalIfIndex`、`lldpV2RemLocalDestMACAddress`、
`lldpV2RemIndex`。路径 `...lldpV2RemTable(1).lldpV2RemEntry(1)`。

| 名称 | OID 后缀 | 类型 | 属性 |
| --- | --- | --- | --- |
| lldpV2RemTimeMark | `.1` | TimeFilter | not-accessible key |
| lldpV2RemLocalIfIndex | `.2` | InterfaceIndex | not-accessible key |
| lldpV2RemLocalDestMACAddress | `.3` | LldpV2DestAddressTableIndex | not-accessible key |
| lldpV2RemIndex | `.4` | Unsigned32 | not-accessible key |
| lldpV2RemChassisIdSubtype | `.5` | LldpV2ChassisIdSubtype | 只读 key |
| lldpV2RemChassisId | `.6` | LldpV2ChassisId | 只读 |
| lldpV2RemPortIdSubtype | `.7` | LldpV2PortIdSubtype | 只读 |
| lldpV2RemPortId | `.8` | LldpV2PortId | 只读 |
| lldpV2RemPortDesc | `.9` | SnmpAdminString | 只读 |
| lldpV2RemSysName | `.10` | SnmpAdminString | 只读 |
| lldpV2RemSysDesc | `.11` | SnmpAdminString | 只读 |
| lldpV2RemSysCapSupported | `.12` | LldpV2SystemCapabilitiesMap | 只读 |
| lldpV2RemSysCapEnabled | `.13` | LldpV2SystemCapabilitiesMap | 只读 |
| lldpV2RemRemoteChanges | `.14` | TruthValue | 只读 |
| lldpV2RemTooManyNeighbors | `.15` | TruthValue | 只读 |

#### 2.4.3 远端管理地址表 lldpV2RemManAddrTable

索引：`lldpV2RemTimeMark`、`lldpV2RemLocalIfIndex`、`lldpV2RemLocalDestMACAddress`、
`lldpV2RemIndex`、`lldpV2RemManAddrSubtype`、`lldpV2RemManAddr`。

| 名称 | OID | 类型 | 属性 |
| --- | --- | --- | --- |
| lldpV2RemManAddrSubtype | `.1.3.111.2.802.1.1.13.1.4.2.1.1` | AddressFamilyNumbers | not-accessible |
| lldpV2RemManAddr | `.1.3.111.2.802.1.1.13.1.4.2.1.2` | LldpV2ManAddress | not-accessible |
| lldpV2RemManAddrIfSubtype | `.1.3.111.2.802.1.1.13.1.4.2.1.3` | LldpV2ManAddrIfSubtype | 只读 |
| lldpV2RemManAddrIfId | `.1.3.111.2.802.1.1.13.1.4.2.1.4` | Unsigned32 | 只读 |

#### 2.4.4 LLDPv2 TRAP

| OID | 节点名称 | 绑定变量 |
| --- | --- | --- |
| `.1.3.111.2.8802.1.1.13.0.0.1` | lldpv2RemTablesChange | lldpv2StatsRemTablesInserts / Deletes / Drops / Ageouts |

实现说明：链路发现数据由 `lldpd` 提供。当前 `lldpd 1.0.20` 仅实现 LLDP-MIB v1
（根 `.1.0.8802.1.1.2`，含 lldpLocPortTable / lldpRemTable / lldpRemManAddrTable 与
lldpRemTablesChange Trap），与本节 LLDP-V2-MIB 根（`.1.3.111.2.802.1.1.13`）语义等价
但 OID 不同，见 §5 差距说明。

### 2.5 IF-MIB（RFC 2863）

节点路径：`...mib-2(1).interface(2).ifTable(2)`。

- `ifNumber`（`.1.3.6.1.2.1.2.1`，只读）：接口数量。
- `ifTable`（索引 ifIndex）：ifIndex / ifDescr / ifType / ifMtu / ifSpeed /
  ifPhysAddress / ifAdminStatus / ifOperStatus / ifLastChange / ifInOctets /
  ifInUcastPkts / ifInErrors / ifOutOctets / ifOutUcastPkts / ifOutErrors / ifSpecific 等。
- TRAP：`linkUp`（`.1.3.6.1.6.3.1.1.5.4`）、`linkDown`（`.1.3.6.1.6.3.1.1.5.3`），
  绑定 ifIndex、ifAdminStatus、ifOperStatus、ifDescr。

### 2.6 ifXTable（RFC 2863）

节点路径：`...mib-2(1).ifMIB(31).ifMIBObjects(1).ifXTable(1)`，索引 ifIndex。
提供 64 位计数 `ifHCInOctets`、`ifHCOutOctets` 等。

### 2.7 RFC1213-MIB（MIB-II）

节点路径：`...mib-2(1).ip(4)`。`ipAddrTable`、`ipRouteTable`，用于 IP 数据报转发参数
与地址/路由查询。

### 2.8 SNMP-TARGET-MIB（RFC 3413）

节点路径：`iso(1).org(3).dod(6).internet(1).snmpV2(6).snmpModules(3).snmpTargetMIB(12)`。

- `snmpTargetAddrTable`：SNMP 消息目标传输地址（发给谁），read-create。
  字段：snmpTargetAddrName、snmpTargetAddrTDomain、snmpTargetAddrTAddress、
  snmpTargetAddrTimeout、snmpTargetAddrRetryCount、snmpTargetAddrTagList、
  snmpTargetAddrParams、snmpTargetAddrStorageType、snmpTargetAddrRowStatus。
- `snmpTargetParamsTable`：发送使用的安全参数集（用什么身份/安全级别），read-create。
  字段：snmpTargetParamsName、snmpTargetParamsMPModel（SNMPv1(0)/v2c(1)/v3(3)）、
  snmpTargetParamsSecurityModel（v1(1)/v2c(2)/USM(3)）、snmpTargetParamsSecurityName、
  snmpTargetParamsSecurityLevel（noAuthNoPriv(1)/authNoPriv(2)/authPriv(3)）、
  snmpTargetParamsStorageType、snmpTargetParamsRowStatus。

### 2.9 SNMP-COMMUNITY-MIB（RFC 3584）

节点路径：`...snmpV2(6).snmpModules(3).snmpCommunityMIB(18).snmpCommunityTable(1.1.1)`。
定义 v1/v2c community 与 v3 安全模型的映射（coexistence），read-create：
snmpCommunityIndex、snmpCommunityName、snmpCommunitySecurityName、
snmpCommunityContextEngineID、snmpCommunityContextName、snmpCommunityTransportTag、
snmpCommunityStorageType、snmpCommunityStatus。

## 3 与既有实现的映射

| MIB | 当前状态 | 本次实现 |
| --- | --- | --- |
| system（sysDescr/UpTime/Services） | 已有（mibII/system_mib） | 保持不变 |
| sysObjectID 企业 OID | 默认 Net-SNMP OID | 配置为 `1.3.6.1.4.1.62446.6.1.905.1` |
| sysContact/sysName/sysLocation 读写 | 只读（VACM write=none） | 开放 VACM 写视图 + Set，持久化 |
| BRIDGE-MIB dot1dBaseBridgeAddress | 无 | pass_persist 扩展 |
| ENTITY-MIB entPhysicalTable | 无 | pass_persist 扩展（chassis + port 行） |
| LLDP（本地/远端/管理地址/Trap） | LLDP-MIB v1（lldpd） | 保持 v1，见 §5 差距 |
| IF-MIB + ifXTable | 已有 | 保持不变 |
| RFC1213 ipAddrTable/ipRouteTable | 已有（mibII/ip） | 保持不变 |
| SNMP-TARGET-MIB | 未启用（target 模块被排除） | 启用 target 模块 |
| SNMP-COMMUNITY-MIB | 无（Net-SNMP 不实现该表） | 见 §5 差距 |

## 4 实现机制

### 4.1 SNMP Set 与写视图

`sysContact`、`sysName`、`sysLocation` 在 Net-SNMP 中注册为 `HANDLER_CAN_RWRITE`。
为使 SNMP Set 生效且不开放全 `.1` 写权限，为 v1/v2c 与 v3 增加一个只含三个标签
OID 的 VACM 写视图：

- `.1.3.6.1.2.1.1.4`（sysContact）
- `.1.3.6.1.2.1.1.5`（sysName）
- `.1.3.6.1.2.1.1.6`（sysLocation）

其余对象保持只读。Set 值由 Net-SNMP 持久化到 `/usr/lib/snmp/snmpd.conf`
（`psyscontact`/`psysname`/`psyslocation`），重启不丢失。

### 4.2 pass_persist 扩展（ENTITY-MIB + BRIDGE-MIB）

Net-SNMP 的 `pass_persist` 机制注册扩展脚本，为不内置的 MIB 提供只读数据：

- `pass_persist 1.3.6.1.2.1.17.1.1 <脚本>` → `dot1dBaseBridgeAddress`（设备 MAC）。
- `pass_persist 1.3.6.1.2.1.47 <脚本>` → `entPhysicalTable`（chassis 1 行 + 端口 5 行）。

脚本读取 Factory 分区 MAC、设备型号/序列号/软硬件版本，按 pass_persist 协议应答。

## 5 差距与后续整改

1. **LLDP-V2-MIB**：`lldpd 1.0.20` 仅实现 LLDP-MIB v1（根 `.1.0.8802.1.1.2`），
   与本设计 LLDP-V2-MIB（根 `.1.3.111.2.802.1.1.13`）OID 不同、数据等价。如需
   V2 OID，需替换/扩展 LLDP 子代理或新增 V1→V2 转换子代理。
2. **SNMP-COMMUNITY-MIB**：Net-SNMP 5.9.4 不实现 `snmpCommunityTable`（只通过
   `rocommunity`/`rwcommunity` 内部管理）。如客户强依赖该表，需自研 AgentX 子代理。
3. **私有 MIB**：已迁移到汇川企业 OID，根为 `1.3.6.1.4.1.62446.6.1.905.1`（与
   `sysObjectID` 一致），并补齐 CONTACT-INFO/REVISION 元数据。原 Net-SNMP 实验
   OID `8072.9999` 不再使用。
4. **SNMP-TARGET-MIB 只读 vs read-create**：target 模块启用后默认支持 read-create；
   生产如需限制为只读，通过 VACM 视图收敛。
