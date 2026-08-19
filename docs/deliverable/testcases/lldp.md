# LLDP 测试用例（SRS 4.9）

模块代码：`LLDP`；需求条目：3。

| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- | --- |
| LLDP-001 | 4.9.1 | LLDP默认配置 | P1 | 接入 LLDP 邻居 | 1. 核对默认 LLDP 参数<br>2. 核对周期性发送与 TTL<br>3. 断开/恢复邻居核对告警 | LLDP 默认使能，参数符合默认值 |
| LLDP-002 | 4.9.2 | LLDP基本TLV | P1 | 接入第三方 LLDP 邻居并抓包 | 1. 用本机 docker 运行 lldpd（host 网络）向设备 WAN 口发送 LLDP<br>2. 抓包核对 Chassis/Port/TTL/End/Management Address TLV<br>3. 核对设备经 get_topology/LLDP-MIB lldpRemTable 发现邻居（SysName/PortID） | 基本 TLV 正确发送，设备可发现模拟邻居（含 SysName 与端口） |
| LLDP-003 | 4.9.3 | LLDP SNMP MIB节点 | P1 | NMS 安装交付 MIB | 1. walk LLDP-MIB(1.0.8802.1.1.2)<br>2. walk LLDP-EXT-DOT1/DOT3-MIB<br>3. 核对收发统计与本地/远端信息 | LLDP 相关 MIB 可查询 |
