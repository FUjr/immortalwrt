# SNMP 测试用例（SRS 4.10）

模块代码：`SNMP`；需求条目：1。

| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- | --- |
| SNMP-001 | 4.10 | SNMP v1/v2c/v3 Get/GetNext/Set/BulkGet | P0 | NMS 安装 Net-SNMP 与交付 MIB | 1. 配置：经 Web(Switch Operations→SNMP/LLDP) 或 UCI 启用 SNMP（v2c 社区 public、v3 misectel/SHA-256/AES-256、listen 0.0.0.0:161）<br>2. Get：sysObjectID.0(应=1.3.6.1.4.1.62446.6.1.905.1)、sysName.0(=7621 vrf evb)、sysDescr.0、sysLocation.0、sysContact.0<br>3. GetNext/Walk：ENTITY-MIB entPhysicalTable(1.3.6.1.2.1.47.1.1.1.1)、BRIDGE-MIB dot1dBaseBridgeAddress(1.3.6.1.2.1.17.1.1.0)、LLDP-MIB lldpLocTable(1.0.8802.1.1.2.1.3)/lldpRemTable(1.0.8802.1.1.2.1.4)<br>4. Set：snmpset sysName.0/sysContact.0/sysLocation.0（v2c 与 v3 authPriv 均须写入成功并回读一致）<br>5. SNMPv3 authPriv：SHA-256/AES-256 查询与 Set<br>6. 反向：错误口令、非白名单源、只读 OID(sysDescr/sysObjectID) Set 被拒(noAccess) | Get/GetNext/BulkGet 可用；Set 限三个管理标签成功，只读对象被拒 |
