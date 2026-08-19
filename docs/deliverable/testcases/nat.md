# NAT功能 测试用例（SRS 4.15）

模块代码：`NAT`；需求条目：10。

| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- | --- |
| NAT-001 | 4.15.1 | WAN口与LAN口不能互通 | P0 | WAN/LAN 各接终端 | 1. 默认状态核对 WAN↔LAN 不互通<br>2. 核对无默认路由<br>3. 核对各 VRF 间隔离 | WAN 口与 LAN 口默认不能互通 |
| NAT-002 | 4.15.2 | NAT转发时延小于1ms | P0 | WAN/LAN 独立测试终端，RFC 2544 工具 | 1. 配置 1:1 NAT<br>2. RFC 2544 不同包长测时延<br>3. 记录平均/最大时延 | NAT 转发时延 <1ms（当前未达） |
| NAT-003 | 4.15.3 | NAT转发带宽(100Mbps/≥15Kpps) | P0 | WAN/LAN 独立测试终端，iperf3 | 1. 配置 1:1 NAT<br>2. 测 UDP 小包 pps<br>3. 测正/反向吞吐与丢包 | 带宽 ≥100Mbps、≥15Kpps（pps 通过，吞吐未达） |
| NAT-004 | 4.15.4 | WEB Server Access via NAPT | P0 | 内网有 Web 服务器，WAN 侧客户端 | 1. 配置端口 1:N 映射到内网 Web<br>2. WAN 侧经外部地址访问<br>3. 核对源地址转换与回程 | 经 NAPT 可访问内网 Web 服务 |
| NAT-005 | 4.15.5 | Serial Machines with Destination NAT | P0 | 内网串行设备 + 外部客户端 | 1. 配置目的 NAT 映射<br>2. 外部按映射地址访问<br>3. 抓包核对目的地址改写 | 目的 NAT 生效，串行设备可访问 |
| NAT-006 | 4.15.6 | C2C通信双向NAT | P0 | 两隔离 VRF 终端 + 外部对端 | 1. 配置双向 1:1 NAT<br>2. 从 WAN 与 VRF 两侧建立新连接<br>3. 抓包核对双向源/目的转换 | C2C 双向 NAT 生效 |
| NAT-007 | 4.15.7 | 多产线设备IP地址重复场景 | P0 | 多个 VRF 使用相同地址空间 | 1. 多 VRF 配置相同内网地址<br>2. 各 VRF 同时访问并核对隔离<br>3. 核对 NAT 正确选 VRF | 重复 IP 在不同 VRF 并发工作且隔离 |
| NAT-008 | 4.15.8 | OPC UA PubSub场景 | P1 | OPC UA PubSub 订阅/发布端 | 1. 配置组播 NAT<br>2. OPC UA PubSub 发布/订阅端到端通信<br>3. 核对组地址与源地址转换 | OPC UA PubSub 组播可经 NAT 通信 |
| NAT-009 | 4.15.9 | Ethernet/IP组播NAT | P0 | Ethernet/IP 组播源与订阅端 | 1. 配置外部↔内部组播地址映射<br>2. 双向发送组播核对目的组改写<br>3. 核对源地址 SNAT | Ethernet/IP 组播 NAT 生效 |
| NAT-010 | 4.15.10 | NAT ALG FTP | P2 | FTP 客户端/服务器跨 NAT | 1. 启用 FTP ALG<br>2. FTP 主动/被动模式传输<br>3. 核对数据连接穿透 | FTP 数据连接可穿透 NAT（完整验收待补） |
