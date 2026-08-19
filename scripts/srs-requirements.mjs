// NEX905-F-40 软件需求规格说明书（SRS）需求数据源。
// 模块划分与《设备级网络解决方案 V1R1 / CH26010012》SRS 第 4 章一致（4.1 ~ 4.21）。
// status 取值：implemented / partial / blocked / deferred / not / unsupported。

export const modules = [
  {
    code: 'MAC',
    name: 'MAC地址',
    section: '4.1',
    requirements: [
      {
        srs: '4.1.1', id: 'MAC-001', name: '支持2048个动态MAC地址', priority: 'P0',
        status: 'implemented', note: 'MT7530 交换芯片 2048 项 FDB；使能静态 MAC/IGMP 时动态可用数相应减少',
        precondition: '网关已上电，LAN 侧接入可产生不同源 MAC 的终端',
        steps: ['通过 Web/NMS 产生并学习动态 MAC', '分页查询 FDB 并统计动态条目数', '接近/超过 2048 时观察学习与老化行为'],
        expected: '动态 MAC 地址最大支持 2048 条，查询不影响转发'
      },
      {
        srs: '4.1.2', id: 'MAC-002', name: '支持MAC地址老化时间', priority: 'P0',
        status: 'implemented', note: '老化时间可配，默认 300s；可调范围见交换运维页',
        precondition: '动态 MAC 已学习，可控制终端静默时间',
        steps: ['配置老化时间 200~400s（默认 300s）', '终端静默超过老化时间后查询 FDB', '恢复默认并核对持久化'],
        expected: '老化时间取值范围 200~400s、默认 300s，超时条目被老化'
      },
      {
        srs: '4.1.3', id: 'MAC-003', name: '支持静态MAC地址配置', priority: 'P0',
        status: 'implemented', note: '静态 MAC/端口绑定，重启持久化',
        precondition: '准备若干可控 MAC 与端口',
        steps: ['手工建立静态 MAC 与端口绑定', '重启服务/设备后核对静态条目保留', '删除静态条目并确认释放'],
        expected: '静态 MAC 可配置、可查询、重启不丢失'
      },
      {
        srs: '4.1.4', id: 'MAC-004', name: 'MAC地址白名单配置及查询', priority: 'P1',
        status: 'implemented', note: '端口允许列表（allowlist）',
        precondition: '准备合法与非法 MAC 流量',
        steps: ['配置端口白名单（允许列表）', '注入白名单内/外 MAC 流量', '核对允许/阻断行为并查询白名单'],
        expected: '白名单内 MAC 放行，白名单外被阻断'
      },
      {
        srs: '4.1.5', id: 'MAC-005', name: 'MAC地址黑名单配置及查询', priority: 'P1',
        status: 'implemented', note: '黑名单（blocklist）过滤，同时配置时先查黑名单再查白名单',
        precondition: '准备合法与非法 MAC 流量',
        steps: ['配置端口黑名单', '注入黑名单内/外 MAC 流量', '同时配置黑白名单，核对先黑后白检查顺序'],
        expected: '黑名单 MAC 被阻断，先检查黑名单再检查白名单'
      },
      {
        srs: '4.1.6', id: 'MAC-006', name: '支持MAC地址查询', priority: 'P0',
        status: 'implemented', note: '动/静态 MAC 分页查询，旁路轮询不阻塞业务',
        precondition: '已存在动态与静态 MAC 表项',
        steps: ['分页查询 FDB 动态与静态条目', '查询期间持续转发业务流量', '核对查询延迟与条目完整性'],
        expected: 'MAC 地址表可查询，查询不阻塞转发'
      }
    ]
  },
  {
    code: 'PORT',
    name: '端口',
    section: '4.2',
    requirements: [
      {
        srs: '4.2.1', id: 'PORT-001', name: '支持端口速率配置', priority: 'P1',
        status: 'implemented', note: 'auto / 100M Full / 100M Half，默认自协商',
        precondition: 'WAN/LAN 对端支持指定速率',
        steps: ['配置端口 auto / 100M Full / 100M Half', '读取协商速率与双工并与对端交叉核对', '恢复自动协商并核对持久化'],
        expected: '端口速率/双工可配，默认自协商，配置生效并持久化'
      },
      {
        srs: '4.2.2', id: 'PORT-002', name: '支持端口MDIX配置', priority: 'P2',
        status: 'not', note: '当前未提供 AUTO/NORMAL/CROSS 的 MDIX 配置面，仅芯片自动 MDI/MDI-X',
        precondition: '准备直连/交叉线缆',
        steps: ['尝试配置 MDIX AUTO/NORMAL/CROSS', '用不同线缆验证链路建立', '核对配置持久化'],
        expected: '支持 AUTO/NORMAL/CROSS（当前版本不交付，待后续实现）'
      },
      {
        srs: '4.2.3', id: 'PORT-003', name: '支持端口流控使能配置', priority: 'P1',
        status: 'implemented', note: 'RX/TX 流控，默认不使能',
        precondition: '对端支持流控，可注入拥塞流量',
        steps: ['使能/关闭端口 RX/TX 流控', '注入拥塞流量观察 PAUSE 帧', '恢复默认并核对持久化'],
        expected: '流控使能/关闭可配，默认不使能'
      },
      {
        srs: '4.2.4', id: 'PORT-004', name: '支持端口MTU默认为1552', priority: 'P1',
        status: 'partial', note: '交换芯片支持 1518/1536/1552/9K，MTU 配置页尚未在 VRF 成员端口页提供',
        precondition: '对端支持巨型帧/1552 MTU',
        steps: ['读取端口当前 MTU', '按 1552 边界发送报文验证不丢包', '核对 MTU 配置入口与持久化'],
        expected: '端口 MTU 默认 1552（VLAN 下 1522 由 1552 覆盖），配置页待补'
      },
      {
        srs: '4.2.5', id: 'PORT-005', name: '支持LAN端口隔离，默认不使能', priority: 'P1',
        status: 'implemented', note: '通过 VRF 实现端口间二层/三层隔离，默认各端口独立 VRF',
        precondition: '两个 LAN 端口各接一台终端',
        steps: ['默认状态验证端口间隔离（不通）', '加入同一 VRF/隔离组后验证互通', '核对二层隔离三层互通与全隔离模式'],
        expected: '端口隔离默认不使能；使能后隔离组内二层/三层隔离生效'
      },
      {
        srs: '4.2.6', id: 'PORT-006', name: '支持端口未知单播、多播和广播风暴抑制', priority: 'P1',
        status: 'partial', note: '广播/多播风暴抑制已实现（tc ingress policer）；未知单播抑制待补',
        precondition: '隔离压测网，可注入广播/多播/未知单播流量',
        steps: ['按端口速率百分比配置广播/多播/未知单播抑制', '注入对应风暴流量并核对限速', '核对默认不使能与持久化'],
        expected: '风暴抑制可配、默认不使能；未知单播抑制待补'
      },
      {
        srs: '4.2.7', id: 'PORT-007', name: '支持端口入口和出口限速功能', priority: 'P1',
        status: 'implemented', note: 'tc/DSA 实现入口/出口限速，实机临时策略验证并恢复',
        precondition: '可注入双向流量并观测吞吐',
        steps: ['配置入口/出口限速速率', '注入流量核对吞吐被限', '恢复默认并核对持久化'],
        expected: '入口/出口限速可配且生效'
      },
      {
        srs: '4.2.8', id: 'PORT-008', name: '支持端口RMON功能', priority: 'P2',
        status: 'partial', note: '统计与告警通过 EtherLike-MIB/私有 MIB/事件实现；完整 RMON(RFC 2819)四组未单独交付',
        precondition: 'NMS 与流量发生器就绪',
        steps: ['查询端口统计、历史与告警计数', '触发阈值并核对告警/事件', '核对 RMON 相关 MIB 可读'],
        expected: '端口统计与告警可用（完整 RMON 待确认）'
      },
      {
        srs: '4.2.9', id: 'PORT-009', name: '端口支持link/activity灯', priority: 'P0',
        status: 'implemented', note: '硬件 LED：link up 亮灯、有收发闪灯、down 灭灯',
        precondition: '观察 LAN/WAN 端口指示灯',
        steps: ['端口 down 时观察灭灯', '端口 up 时观察亮灯', '收发报文时观察闪灯'],
        expected: 'link down 灭灯、up 亮灯、收发闪灯'
      },
      {
        srs: '4.2.10', id: 'PORT-010', name: '端口状态', priority: 'P0',
        status: 'implemented', note: '实时 UP/DOWN、速率、双工、收发统计、错误统计(CRC/冲突)',
        precondition: '存在正常链路与至少一种可控故障',
        steps: ['读取端口 UP/DOWN、速率、双工', '读取收发包与 CRC/冲突错误计数', '制造链路故障核对状态与错误计数变化'],
        expected: '端口状态、速率、双工、收发/错误统计可实时查询'
      }
    ]
  },
  {
    code: 'QOS',
    name: 'QoS',
    section: '4.3',
    requirements: [
      {
        srs: '4.3.1', id: 'QOS-001', name: '支持QoS调度模式，默认为SP', priority: 'P2',
        status: 'not', note: 'SP/WFP/SP+WFP 调度模式未交付，MT7530 QoS 配置面待开发',
        precondition: '注入多队列流量',
        steps: ['配置 SP/WFP/SP+WFP 调度模式', '注入多队列流量核对出队顺序', '核对默认 SP 与持久化'],
        expected: '支持 SP/WFP/SP+WFP，默认 SP（当前版本不交付）'
      },
      {
        srs: '4.3.2', id: 'QOS-002', name: '支持802.1P和DSCP,默认为802.1P', priority: 'P2',
        status: 'not', note: '802.1P/DSCP 优先级与映射配置面未交付',
        precondition: '注入带 802.1P/DSCP 标记的流量',
        steps: ['配置信任 802.1P 或 DSCP', '注入标记流量核对队列/优先级', '核对默认 802.1P 与持久化'],
        expected: '支持 802.1P/DSCP，默认 802.1P（当前版本不交付）'
      },
      {
        srs: '4.3.3', id: 'QOS-003', name: '端口QoS优先级：ACL > 802.1P > DSCP > 端口优先级', priority: 'P2',
        status: 'not', note: '优先级叠加顺序未交付',
        precondition: '同时配置 ACL/802.1P/DSCP/端口优先级',
        steps: ['叠加配置各类优先级来源', '注入流量核对生效优先级顺序', '核对 ACL>802.1P>DSCP>端口'],
        expected: '优先级顺序 ACL > 802.1P > DSCP > 端口优先级（当前版本不交付）'
      },
      {
        srs: '4.3.4', id: 'QOS-004', name: 'CoS映射', priority: 'P2',
        status: 'not', note: 'CoS 0-7 到队列映射未交付',
        precondition: '注入不同 CoS 流量',
        steps: ['配置 CoS→队列映射', '注入 CoS 0~7 流量核对队列', '核对映射表与持久化'],
        expected: 'CoS 0~7 到队列映射可配（当前版本不交付）'
      },
      {
        srs: '4.3.5', id: 'QOS-005', name: 'DSCP映射', priority: 'P2',
        status: 'not', note: 'DSCP 到 CoS 映射未交付',
        precondition: '注入不同 DSCP 流量',
        steps: ['配置 DSCP→CoS 映射（0-7…56-63→0-7）', '注入 DSCP 流量核对 CoS', '核对映射表与持久化'],
        expected: 'DSCP 到 CoS 映射可配（当前版本不交付）'
      },
      {
        srs: '4.3.6', id: 'QOS-006', name: '802.1P映射', priority: 'P2',
        status: 'not', note: 'VLAN 优先级到 CoS 映射未交付',
        precondition: '注入不同 802.1P 流量',
        steps: ['配置 802.1P→CoS 映射', '注入 802.1P 0~7 流量核对 CoS', '核对映射表与持久化'],
        expected: '802.1P 到 CoS 映射可配（当前版本不交付）'
      }
    ]
  },
  {
    code: 'VLAN',
    name: 'VLAN',
    section: '4.4',
    requirements: [
      {
        srs: '4.4.1', id: 'VLAN-001', name: 'LAN/WAN默认使能VLAN 1', priority: 'P1',
        status: 'partial', note: '底层 MT7530 VLAN 1 使能；上层采用 VRF 桥接模型，VLAN 配置页面未交付',
        precondition: '接入终端并观察二层/三层行为',
        steps: ['核对 WAN/LAN 默认 VLAN 1', '验证同 VLAN 内二层转发', '核对 VLAN 配置入口与持久化'],
        expected: 'LAN/WAN 默认 VLAN 1 使能，转发正常'
      },
      {
        srs: '4.4.2', id: 'VLAN-002', name: 'LAN支持优先级VLAN转发', priority: 'P2',
        status: 'not', note: '优先级 VLAN 转发未交付',
        precondition: '注入带 VLAN 优先级的流量',
        steps: ['配置优先级 VLAN', '注入带优先级标记的 VLAN 流量', '核对按优先级转发'],
        expected: 'LAN 支持优先级 VLAN 转发（当前版本不交付）'
      }
    ]
  },
  {
    code: 'IPADDR',
    name: 'IP地址',
    section: '4.5',
    requirements: [
      {
        srs: '4.5.1', id: 'IP-001', name: '设备管理IP地址', priority: 'P0',
        status: 'implemented', note: 'WAN 管理 IP（默认 192.168.1.1/24）、掩码、网关；本机名称/主机名统一为 7621 vrf evb，admin 账号',
        precondition: '管理主机可达设备',
        steps: ['通过 Web（System → Administration）配置主机名 7621 vrf evb、IPv4、掩码、网关', '通过 SNMP 核对 sysName.0 = 7621 vrf evb', '重启后核对持久化'],
        expected: '管理 IP 可配，默认 192.168.1.1/24、网关 192.168.1.1，本机名称 7621 vrf evb'
      },
      {
        srs: '4.5.2', id: 'IP-002', name: 'IP地址欺骗防攻击(IPSG)', priority: 'P1',
        status: 'partial', note: 'IP-MAC 静态绑定 + 源 IP/MAC 校验（监控/阻断）已实现；完整 IPSG 绑定表语义待确认',
        precondition: '准备可伪造源 IP/MAC 的终端',
        steps: ['配置 IP-MAC 绑定与源校验（monitor/enforce）', '伪造源 IP/MAC 发送报文', '核对阻断与日志'],
        expected: '非绑定源 IP/MAC 报文被过滤，合法报文放行'
      },
      {
        srs: '4.5.3', id: 'IP-003', name: 'ACL控制', priority: 'P1',
        status: 'implemented', note: '基于 IP 的 ACL（IPv4/IPv6），firewall4',
        precondition: '准备合法与非法来源流量',
        steps: ['配置基于 IP 的 ACL（如禁止特定 IP 访问管理口）', '发起合法/非法访问', '核对放行/阻断与日志'],
        expected: '基于 IP 的 ACL 生效，非法访问被拒绝'
      }
    ]
  },
  {
    code: 'ARP',
    name: 'ARP功能',
    section: '4.6',
    requirements: [
      {
        srs: '4.6.1', id: 'ARP-001', name: '静态ARP配置', priority: 'P0',
        status: 'implemented', note: '静态 ARP 增删查改、UCI 持久化、仅清理自有邻居',
        precondition: '准备多个 IP/MAC 终端',
        steps: ['创建/查询/更新/删除静态 ARP', '核对不被动态 ARP 覆盖、不老化', '重启后核对持久化'],
        expected: '静态 ARP 可配置，不被老化/覆盖'
      },
      {
        srs: '4.6.2', id: 'ARP-002', name: '防ARP欺骗攻击，最大支持1024条', priority: 'P0',
        status: 'implemented', note: '静态 ARP 上限 1024；IP/源MAC/目的MAC 三检查项可组合',
        precondition: '准备 ARP 攻击流量与满表工具',
        steps: ['配置 IP/源MAC/目的MAC 合法性检查', '注入非法 ARP 报文核对丢弃', '配置 1024 条静态 ARP 并验证容量'],
        expected: '非法 ARP 被过滤，静态 ARP 最大 1024 条'
      },
      {
        srs: '4.6.3', id: 'ARP-003', name: 'ARP代理', priority: 'P0',
        status: 'implemented', note: 'Proxy ARP 逐接口启停、状态与持久化',
        precondition: '构造跨广播域同网段主机场景',
        steps: ['启用 Proxy ARP', '构造 Host_1/Host_2 同网段不同物理网场景', '核对网关以自身 MAC 代答'],
        expected: 'ARP 代理使能后，跨物理网同网段主机可经网关通信'
      }
    ]
  },
  {
    code: 'DNS',
    name: 'DNS',
    section: '4.7',
    requirements: [
      {
        srs: '4.7.1', id: 'DNS-001', name: '静态DNS', priority: 'P1',
        status: 'implemented', note: '静态域名解析表（dnsmasq host）',
        precondition: '准备可控域名',
        steps: ['配置静态域名→IP 映射', '使用域名访问并核对解析', '重启后核对持久化'],
        expected: '静态域名解析生效，优先于动态解析'
      },
      {
        srs: '4.7.2', id: 'DNS-002', name: '动态DNS', priority: 'P1',
        status: 'implemented', note: '系统解析器（resolver）+ 缓存；DDNS 前端未集成',
        precondition: '准备可控 DNS 服务器',
        steps: ['配置 1~2 个 DNS 服务器', '首次/重复解析域名核对缓存', '核对缓存老化与失效处理'],
        expected: '动态域名解析可用，缓存生效并按 TTL 老化'
      }
    ]
  },
  {
    code: 'NTP',
    name: 'NTP',
    section: '4.8',
    requirements: [
      {
        srs: '4.8.1', id: 'NTP-001', name: '支持NTP客户端', priority: 'P0',
        status: 'implemented', note: 'NTP(RFC 5905) 客户端，兼容 SNTP(RFC 4330)，默认不开启',
        precondition: '准备 NTP 服务器',
        steps: ['配置 NTP 客户端与服务器', '核对首次同步与偏移', '核对默认不开启行为'],
        expected: 'NTP 客户端可用，默认不开启'
      },
      {
        srs: '4.8.2', id: 'NTP-002', name: '支持配置两个以上NTP服务器，自动切换失效服务器', priority: 'P1',
        status: 'implemented', note: '多服务器配置；显式优先级切换仍需专项验收',
        precondition: '准备主、备、失效 NTP 服务器',
        steps: ['配置两个以上 NTP 服务器及优先级', '停止主服务器核对自动切换备用', '恢复主服务器核对回切'],
        expected: '主备冗余，失效自动切换、恢复回切'
      },
      {
        srs: '4.8.3', id: 'NTP-003', name: 'NTP服务器支持IP地址或者DNS', priority: 'P1',
        status: 'implemented', note: '系统解析器支持域名',
        precondition: '准备 IP 与域名 NTP 服务器',
        steps: ['分别用 IP 与域名配置 NTP 服务器', '核对均可同步', '核对域名解析'],
        expected: 'NTP 服务器支持 IP 或 DNS 地址'
      },
      {
        srs: '4.8.4', id: 'NTP-004', name: '支持NTP身份鉴权功能', priority: 'P1',
        status: 'not', note: 'MD5/HMAC-SHA256/AES-CMAC 鉴权管理面未交付',
        precondition: '准备带鉴权 NTP 服务器',
        steps: ['配置 MD5/SHA256/AES-CMAC 鉴权', '核对带鉴权同步成功', '用错误密钥核对失败'],
        expected: 'NTP 鉴权可用（当前版本不交付）'
      },
      {
        srs: '4.8.5', id: 'NTP-005', name: '本地时钟功能(RTC)', priority: 'P1',
        status: 'blocked', note: 'PCF85063AT DTS/驱动已集成，但实机 0x51 无 I2C ACK（返回 -145），硬件需排查',
        precondition: 'RTC 器件可应答',
        steps: ['读取 /dev/rtc0 与 hwclock', '断开 NTP 核对回退本地时钟', '核对掉电保持与精度(24h±2s)'],
        expected: 'NTP 不可用时切换本地时钟（受 RTC 无应答受阻）'
      }
    ]
  },
  {
    code: 'LLDP',
    name: 'LLDP',
    section: '4.9',
    requirements: [
      {
        srs: '4.9.1', id: 'LLDP-001', name: 'LLDP默认配置', priority: 'P1',
        status: 'implemented', note: '全部使能，发送周期 30s、延迟 2s、TTL 倍数 4、接口初始化 2s、告警延时 5s',
        precondition: '接入 LLDP 邻居',
        steps: ['核对默认 LLDP 参数', '核对周期性发送与 TTL', '断开/恢复邻居核对告警'],
        expected: 'LLDP 默认使能，参数符合默认值'
      },
      {
        srs: '4.9.2', id: 'LLDP-002', name: 'LLDP基本TLV', priority: 'P1',
        status: 'implemented', note: 'Chassis ID/Port ID/TTL/End/Management Address TLV 必发包；已用本机 docker 容器(lldpd)模拟邻居实机验证发现',
        precondition: '接入第三方 LLDP 邻居并抓包',
        steps: ['用本机 docker 运行 lldpd（host 网络）向设备 WAN 口发送 LLDP', '抓包核对 Chassis/Port/TTL/End/Management Address TLV', '核对设备经 get_topology/LLDP-MIB lldpRemTable 发现邻居（SysName/PortID）'],
        expected: '基本 TLV 正确发送，设备可发现模拟邻居（含 SysName 与端口）'
      },
      {
        srs: '4.9.3', id: 'LLDP-003', name: 'LLDP SNMP MIB节点', priority: 'P1',
        status: 'implemented', note: 'LLDP-MIB/LLDP-EXT-DOT1-MIB/LLDP-EXT-DOT3-MIB 经 AgentX',
        precondition: 'NMS 安装交付 MIB',
        steps: ['walk LLDP-MIB(1.0.8802.1.1.2)', 'walk LLDP-EXT-DOT1/DOT3-MIB', '核对收发统计与本地/远端信息'],
        expected: 'LLDP 相关 MIB 可查询'
      }
    ]
  },
  {
    code: 'SNMP',
    name: 'SNMP',
    section: '4.10',
    requirements: [
      {
        srs: '4.10', id: 'SNMP-001', name: 'SNMP v1/v2c/v3 Get/GetNext/Set/BulkGet', priority: 'P0',
        status: 'implemented', note: 'Get/GetNext/BulkGet/Set 实机通过；Set 限 sysName/sysContact/sysLocation 三个标签（VACM 写视图 syslabels）；已修复 net-snmp 系统标量因 snmpd.conf 使用 sys* 指令导致的 notWritable（改用 psys* 持久指令）',
        precondition: 'NMS 安装 Net-SNMP 与交付 MIB',
        steps: [
          '配置：经 Web(Switch Operations→SNMP/LLDP) 或 UCI 启用 SNMP（v2c 社区 public、v3 misectel/SHA-256/AES-256、listen 0.0.0.0:161）',
          'Get：sysObjectID.0(应=1.3.6.1.4.1.62446.6.1.905.1)、sysName.0(=7621 vrf evb)、sysDescr.0、sysLocation.0、sysContact.0',
          'GetNext/Walk：ENTITY-MIB entPhysicalTable(1.3.6.1.2.1.47.1.1.1.1)、BRIDGE-MIB dot1dBaseBridgeAddress(1.3.6.1.2.1.17.1.1.0)、LLDP-MIB lldpLocTable(1.0.8802.1.1.2.1.3)/lldpRemTable(1.0.8802.1.1.2.1.4)',
          'Set：snmpset sysName.0/sysContact.0/sysLocation.0（v2c 与 v3 authPriv 均须写入成功并回读一致）',
          'SNMPv3 authPriv：SHA-256/AES-256 查询与 Set',
          '反向：错误口令、非白名单源、只读 OID(sysDescr/sysObjectID) Set 被拒(noAccess)'
        ],
        expected: 'Get/GetNext/BulkGet 可用；Set 限三个管理标签成功，只读对象被拒'
      }
    ]
  },
  {
    code: 'WEB',
    name: 'WEB网管',
    section: '4.11',
    requirements: [
      {
        srs: '4.11.1', id: 'WEB-001', name: '支持HTTP/HTTPS', priority: 'P0',
        status: 'implemented', note: 'HTTPS 默认使能(443)、HTTP 默认关闭(80)，会话超时 15min',
        precondition: '浏览器与管理主机就绪',
        steps: ['发起 HTTPS/HTTP 连接', '核对端口与默认使能状态', '核对会话超时'],
        expected: 'HTTPS 默认使能，HTTP 默认关闭，超时 15 分钟'
      },
      {
        srs: '4.11.2', id: 'WEB-002', name: 'SSL证书', priority: 'P0',
        status: 'implemented', note: 'X.509 自签名，CN=INOVANCE NEX905-F-40 SN(XXX) MAC(XXX)，RSA 4096，有效期 10 年，支持导入客户证书',
        precondition: '浏览器可查看证书',
        steps: ['核对证书字段(CN/O/OU/有效期/密钥长度)', '核对 SAN/KeyUsage/ExtendedKeyUsage', '导入客户证书并核对回退'],
        expected: '证书字段符合规范，客户证书可导入'
      },
      {
        srs: '4.11.3', id: 'WEB-003', name: 'TLS算法', priority: 'P0',
        status: 'implemented', note: 'TLS 1.2 / TLS 1.3',
        precondition: '具备 TLS 1.0-1.3 客户端',
        steps: ['分别发起 TLS 1.0/1.1/1.2/1.3 连接', '核对弱协议被拒、1.2/1.3 通过', '核对加密套件'],
        expected: '支持 TLS 1.2/1.3，弱协议被拒'
      },
      {
        srs: '4.11.4', id: 'WEB-004', name: '支持登录认证', priority: 'P0',
        status: 'implemented', note: '用户管理 + 权限分级(admin root)，默认 admin/Admin@123',
        precondition: '准备管理员/运维/只读账号',
        steps: ['各角色登录并核对权限边界', '核对会话/审计/错误提示', '核对默认账号'],
        expected: '登录认证与权限分级可用'
      },
      {
        srs: '4.11.5', id: 'WEB-005', name: '升级', priority: 'P0',
        status: 'implemented', note: '默认 HTTPS 传输，使能 HTTP 后可用 HTTP；型号/大小/SHA-256 校验',
        precondition: '准备型号匹配与不匹配固件',
        steps: ['上传固件并核对校验', '保留配置升级并等待重上线', '核对失败镜像被拒'],
        expected: 'Web 升级可用，镜像校验通过后才可写入'
      },
      {
        srs: '4.11.6', id: 'WEB-006', name: '功能配置', priority: 'P0',
        status: 'implemented', note: '全部前端配置页经 Playwright 实机验证并逐项配置落盘；详见步骤清单',
        precondition: '浏览器登录 HTTPS 管理界面(root/Admin@12345678)',
        steps: [
          '登录：HTTPS 登录成功，进入 Overview 首页，核对 WAN 状态、活动 VRF、NAT 映射数量显示',
          'Administration：配置主机名 Hostname=7621 vrf evb，Save System Settings 后 board.hostname 回读一致',
          'Network(WAN)：核对 WAN 协议(DHCP/静态/PPPoE)、IPv4、掩码、网关、DNS 配置页可编辑',
          'VRF NAT：新增 Host 1:1 映射(Name/Internal IPv4/External IPv4)→Save 落盘→刷新仍在→Delete 移除',
          'Switch Operations(Ports)：核对端口速率/双工/RX-TX 流控/入口出口限速/风暴抑制字段可配置',
          'Switch Operations(MAC Security)：核对 MAC 上限/违规动作/允许 MAC 列表字段可配置',
          'Switch Operations(SNMP/LLDP)：配置 LLDP 系统名 System name=7621 vrf evb 并 Apply Configuration，RPC 回读 lldp.system_name 一致',
          'ARP & IP-MAC Security：新增 IP-MAC 绑定(Name/IPv4/MAC/Static ARP)→Save 落盘→经 RPC 删除',
          'System Management/Administration/Access Security/Upgrade/System Log：逐页加载并截图',
          '移动端(390×844)首页：核对无文字/控件重叠',
          '全程记录页面 JavaScript 错误(pageerror)'
        ],
        expected: '上述各前端页面与配置功能均通过 Web 操作验证并落盘，RPC/SNMP 回读一致'
      }
    ]
  },
  {
    code: 'SYS',
    name: '系统功能',
    section: '4.12',
    requirements: [
      {
        srs: '4.12.1', id: 'SYS-001', name: '配置(备份/恢复/导出)', priority: 'P0',
        status: 'implemented', note: 'Web 与 CLI 均支持配置备份/恢复/导出',
        precondition: '设备已有自定义配置',
        steps: ['备份并导出配置', '修改配置后导入恢复', '核对恢复结果'],
        expected: '配置备份/恢复/导出可用'
      },
      {
        srs: '4.12.2', id: 'SYS-002', name: '恢复出厂配置', priority: 'P0',
        status: 'implemented', note: '恢复出厂并重新生成 SSL/SSH 证书',
        precondition: '已备份当前配置',
        steps: ['执行恢复出厂', '核对默认配置与证书重新生成', '核对首次口令引导'],
        expected: '恢复出厂生效，证书重新生成'
      },
      {
        srs: '4.12.3', id: 'SYS-003', name: 'SSH证书', priority: 'P1',
        status: 'implemented', note: 'ECDSA≥256 位、RSA 4096 位，示例 ssh-keygen -t rsa -b 4096',
        precondition: '可查看主机密钥',
        steps: ['核对 SSH 主机密钥算法与长度', '核对 ssh-rsa/ed25519/ecdsa 支持', '重启核对密钥持久化'],
        expected: 'SSH 证书算法与长度符合要求'
      },
      {
        srs: '4.12.4', id: 'SYS-004', name: 'MAC地址个数', priority: 'P0',
        status: 'implemented', note: '使用两个 MAC：第一个 WAN、第二个 LAN',
        precondition: '可查询各接口 MAC',
        steps: ['查询 WAN/LAN 接口 MAC', '核对仅用两个 MAC', '核对与序列号/制造信息一致'],
        expected: 'WAN/LAN 各用一个 MAC，共两个 MAC'
      }
    ]
  },
  {
    code: 'CLI',
    name: 'CLI',
    section: '4.13',
    requirements: [
      {
        srs: '4.13.1', id: 'CLI-001', name: 'CLI访问方式', priority: 'P0',
        status: 'implemented', note: '厂家调试用，默认 SSHv2，telnet 默认关闭',
        precondition: '厂家调试账号与隔离网络',
        steps: ['SSHv2 登录并确认旧协议不可用', '核对 telnet 默认关闭', '核对调试入口未向普通用户开放'],
        expected: 'SSHv2 访问可用，telnet 默认关闭'
      },
      {
        srs: '4.13.2', id: 'CLI-002', name: 'CLI功能配置', priority: 'P0',
        status: 'implemented', note: '系统/业务功能配置及查询',
        precondition: 'SSH 已登录',
        steps: ['执行状态查询、配置、批量脚本', '核对权限边界、退出码、日志', '核对实时状态查询'],
        expected: 'CLI 支持系统/业务配置与查询'
      },
      {
        srs: '4.13.3', id: 'CLI-003', name: 'CLI配置(导入/导出/SFTP)', priority: 'P0',
        status: 'implemented', note: '默认使能 SFTP，FTP 默认关闭',
        precondition: 'SSH/SFTP 客户端就绪',
        steps: ['配置导入/导出', 'SFTP 上传/下载', '核对 FTP 默认关闭'],
        expected: '配置导入导出与 SFTP 可用'
      }
    ]
  },
  {
    code: 'ROUTE',
    name: '路由',
    section: '4.14',
    requirements: [
      {
        srs: '4.14', id: 'ROUTE-001', name: '支持静态路由(≥64条)', priority: 'P0',
        status: 'implemented', note: '静态路由含默认网关，最大条目超过 64 条',
        precondition: '上游/下游测试网段可控',
        steps: ['配置 64 条以上静态路由', '查询路由表核对下一跳/优先级/持久化', '对首/中/末条路由做双向流量测试', '删除与重启后核对'],
        expected: '静态路由不少于 64 条且生效'
      }
    ]
  },
  {
    code: 'NAT',
    name: 'NAT功能',
    section: '4.15',
    requirements: [
      {
        srs: '4.15.1', id: 'NAT-001', name: 'WAN口与LAN口不能互通', priority: 'P0',
        status: 'implemented', note: 'VRF 隔离，出厂无默认路由/转发',
        precondition: 'WAN/LAN 各接终端',
        steps: ['默认状态核对 WAN↔LAN 不互通', '核对无默认路由', '核对各 VRF 间隔离'],
        expected: 'WAN 口与 LAN 口默认不能互通'
      },
      {
        srs: '4.15.2', id: 'NAT-002', name: 'NAT转发时延小于1ms', priority: 'P0',
        status: 'partial', note: 'RFC 2544 实测平均 1.222ms，未达 <1ms 门槛',
        precondition: 'WAN/LAN 独立测试终端，RFC 2544 工具',
        steps: ['配置 1:1 NAT', 'RFC 2544 不同包长测时延', '记录平均/最大时延'],
        expected: 'NAT 转发时延 <1ms（当前未达）'
      },
      {
        srs: '4.15.3', id: 'NAT-003', name: 'NAT转发带宽(100Mbps/≥15Kpps)', priority: 'P0',
        status: 'partial', note: '实测 15134.87pps(通过)、正/反 94.78/94.76Mbps(未达 100Mbps)',
        precondition: 'WAN/LAN 独立测试终端，iperf3',
        steps: ['配置 1:1 NAT', '测 UDP 小包 pps', '测正/反向吞吐与丢包'],
        expected: '带宽 ≥100Mbps、≥15Kpps（pps 通过，吞吐未达）'
      },
      {
        srs: '4.15.4', id: 'NAT-004', name: 'WEB Server Access via NAPT', priority: 'P0',
        status: 'implemented', note: 'NAPT/端口 1:N 可访问内网 Web；双向闭环仍需专项验收',
        precondition: '内网有 Web 服务器，WAN 侧客户端',
        steps: ['配置端口 1:N 映射到内网 Web', 'WAN 侧经外部地址访问', '核对源地址转换与回程'],
        expected: '经 NAPT 可访问内网 Web 服务'
      },
      {
        srs: '4.15.5', id: 'NAT-005', name: 'Serial Machines with Destination NAT', priority: 'P0',
        status: 'implemented', note: '目的 NAT(1:1/端口) 串行设备接入',
        precondition: '内网串行设备 + 外部客户端',
        steps: ['配置目的 NAT 映射', '外部按映射地址访问', '抓包核对目的地址改写'],
        expected: '目的 NAT 生效，串行设备可访问'
      },
      {
        srs: '4.15.6', id: 'NAT-006', name: 'C2C通信双向NAT', priority: 'P0',
        status: 'implemented', note: '双向 1:1 NAT，新入站/出站连接用配置外部地址',
        precondition: '两隔离 VRF 终端 + 外部对端',
        steps: ['配置双向 1:1 NAT', '从 WAN 与 VRF 两侧建立新连接', '抓包核对双向源/目的转换'],
        expected: 'C2C 双向 NAT 生效'
      },
      {
        srs: '4.15.7', id: 'NAT-007', name: '多产线设备IP地址重复场景', priority: 'P0',
        status: 'implemented', note: 'VRF 重叠地址，相同内网地址在不同 VRF 同时工作',
        precondition: '多个 VRF 使用相同地址空间',
        steps: ['多 VRF 配置相同内网地址', '各 VRF 同时访问并核对隔离', '核对 NAT 正确选 VRF'],
        expected: '重复 IP 在不同 VRF 并发工作且隔离'
      },
      {
        srs: '4.15.8', id: 'NAT-008', name: 'OPC UA PubSub场景', priority: 'P1',
        status: 'partial', note: '组播 NAT 已实现；OPC UA PubSub 端到端专项验收待补',
        precondition: 'OPC UA PubSub 订阅/发布端',
        steps: ['配置组播 NAT', 'OPC UA PubSub 发布/订阅端到端通信', '核对组地址与源地址转换'],
        expected: 'OPC UA PubSub 组播可经 NAT 通信'
      },
      {
        srs: '4.15.9', id: 'NAT-009', name: 'Ethernet/IP组播NAT', priority: 'P0',
        status: 'implemented', note: 'IPv4 UDP 组地址双向静态转换 + SNAT 已实机验证',
        precondition: 'Ethernet/IP 组播源与订阅端',
        steps: ['配置外部↔内部组播地址映射', '双向发送组播核对目的组改写', '核对源地址 SNAT'],
        expected: 'Ethernet/IP 组播 NAT 生效'
      },
      {
        srs: '4.15.10', id: 'NAT-010', name: 'NAT ALG FTP', priority: 'P2',
        status: 'partial', note: 'FTP conntrack helper 可用；完整 ALG 管理面/协议验收待补',
        precondition: 'FTP 客户端/服务器跨 NAT',
        steps: ['启用 FTP ALG', 'FTP 主动/被动模式传输', '核对数据连接穿透'],
        expected: 'FTP 数据连接可穿透 NAT（完整验收待补）'
      }
    ]
  },
  {
    code: 'DHCP',
    name: 'DHCP功能',
    section: '4.16',
    requirements: [
      {
        srs: '4.16.1', id: 'DHCP-001', name: 'DHCP Client(WAN)', priority: 'P0',
        status: 'implemented', note: 'WAN DHCP Client，默认不开启',
        precondition: 'WAN 侧有 DHCP 服务',
        steps: ['配置 WAN DHCP Client', '获取并释放租约', '核对默认不开启与持久化'],
        expected: 'WAN DHCP Client 可用，默认不开启'
      },
      {
        srs: '4.16.2', id: 'DHCP-002', name: 'DHCP Server(LAN)', priority: 'P0',
        status: 'implemented', note: '每 VRF 独立地址池跟随内网段，网关 + 1~2 DNS + 静态租约；默认不开启',
        precondition: 'LAN/VRF 侧有 DHCP 客户端',
        steps: ['配置每 VRF 地址池/网关/DNS', '客户端获取租约核对下发内容', '验证静态 MAC 租约与重载恢复'],
        expected: 'LAN DHCP Server 可用，地址池跟随内网段'
      }
    ]
  },
  {
    code: 'ACL',
    name: 'ACL',
    section: '4.17',
    requirements: [
      {
        srs: '4.17.1', id: 'ACL-001', name: '基于MAC/IP过滤', priority: 'P1',
        status: 'implemented', note: '源/目的 MAC、IPv4、子网掩码匹配',
        precondition: '多协议流量发生器 + 两个物理口',
        steps: ['创建源/目的 MAC、IPv4、子网匹配规则', '注入应允许/拒绝流量', '核对计数器与日志'],
        expected: '基于 MAC/IP/子网过滤生效'
      },
      {
        srs: '4.17.2', id: 'ACL-002', name: '协议类型过滤', priority: 'P1',
        status: 'implemented', note: 'TCP/UDP 端口、ICMP 类型、IGMP 组播过滤',
        precondition: '多协议流量发生器',
        steps: ['创建 TCP/UDP 端口、ICMP、IGMP 规则', '注入对应协议流量', '核对放行/阻断'],
        expected: 'TCP/UDP/ICMP/IGMP 过滤生效'
      },
      {
        srs: '4.17.3', id: 'ACL-003', name: '动作类型(允许/拒绝/重定向)', priority: 'P1',
        status: 'implemented', note: 'Permit/Deny/物理端口 Redirect，拒绝反向环路',
        precondition: '多协议流量发生器 + 两个物理口',
        steps: ['创建 Permit/Deny/Redirect 规则', '注入流量核对动作与物理出口', '核对同端口环路被拒'],
        expected: '允许/拒绝/重定向动作生效'
      },
      {
        srs: '4.17.4', id: 'ACL-004', name: '端口镜像', priority: 'P1',
        status: 'not', note: '端口镜像未交付',
        precondition: '镜像源口与观察口',
        steps: ['配置指定规则端口镜像', '镜像口抓包核对流量复制', '核对持久化'],
        expected: '端口镜像可用（当前版本不交付）'
      }
    ]
  },
  {
    code: 'SEC',
    name: '网络安全',
    section: '4.18',
    requirements: [
      {
        srs: '4.18.1', id: 'SEC-001', name: '支持DOS和DDOS防护', priority: 'P0',
        status: 'implemented', note: 'Land/synflood/IP欺骗/Smurf/Ping of Death/Teardrop/WinNuke 七类限速，监控/阻断页；有界攻击验收待跑',
        precondition: '隔离压测网 + 受控攻击工具',
        steps: ['配置七类 DoS 防护策略', '注入有界攻击流量', '核对限速/阻断/日志/合法业务'],
        expected: 'DoS/DDoS 防护生效，合法业务不受影响'
      },
      {
        srs: '4.18.2', id: 'SEC-002', name: 'ARP/DHCP防御', priority: 'P1',
        status: 'implemented', note: 'IP-MAC/ARP 防欺骗 + 下联伪 DHCP 服务器阻断',
        precondition: '可注入非法 ARP/DHCP',
        steps: ['配置 ARP/DHCP 防御', '注入非法 ARP/DHCP 报文', '核对过滤与合法流量'],
        expected: '非法 ARP/DHCP 报文被过滤'
      },
      {
        srs: '4.18.3', id: 'SEC-003', name: 'CVE漏洞', priority: 'P1',
        status: 'implemented', note: '已知 CVE 修复 + Web 注入防护；持续跟踪',
        precondition: '具备漏洞扫描工具',
        steps: ['扫描已知 CVE 与 Web 注入', '核对无高危漏洞', '核对漏洞修复流程'],
        expected: '不存在已知 CVE，注入被防护'
      }
    ]
  },
  {
    code: 'LOG',
    name: '日志',
    section: '4.19',
    requirements: [
      {
        srs: '4.19.1', id: 'LOG-001', name: '日志分类(用户/运维)', priority: 'P1',
        status: 'implemented', note: '用户日志(logbuffer/syslog/网管/屏幕) + 运维日志',
        precondition: '触发各类事件',
        steps: ['触发用户操作与运维事件', '核对日志分类与输出渠道', '核对 syslog 归档'],
        expected: '用户/运维日志分类记录'
      },
      {
        srs: '4.19.2', id: 'LOG-002', name: '日志记录(本地/远程Syslog/TLS)', priority: 'P0',
        status: 'implemented', note: '本地存储 + 远程 Syslog over TLS 1.2/1.3 + IP 白名单，默认不开启',
        precondition: '本地日志 + 远程 Syslog 接收器',
        steps: ['配置远程 Syslog over TLS 与白名单', '触发事件核对归档', '核对默认不开启与目标白名单'],
        expected: '本地与远程 Syslog(TLS) 归档可用'
      },
      {
        srs: '4.19.3', id: 'LOG-003', name: '日志快速检索', priority: 'P1',
        status: 'implemented', note: '按时间、事件类型、关键字、分页检索',
        precondition: '已产生多类日志',
        steps: ['按时间/类型/关键字检索日志', '核对分页与延迟', '核对导出'],
        expected: '日志可按时间/类型快速检索并导出'
      }
    ]
  },
  {
    code: 'REL',
    name: '可靠性',
    section: '4.20',
    requirements: [
      {
        srs: '4.20.1', id: 'REL-001', name: '设备可用性(30*24H不宕机)', priority: 'P0',
        status: 'deferred', note: '需 30*24H 长稳与大量报文上送 CPU 专项验证',
        precondition: '长时间运行环境',
        steps: ['典型工况持续运行 30*24H', '大量报文上送 CPU 观察不宕机', '记录内存/CPU/转发状态'],
        expected: '30*24H 正常运行不宕机'
      },
      {
        srs: '4.20.2', id: 'REL-002', name: '外部连接可用', priority: 'P0',
        status: 'deferred', note: '常态保持可用；大量 ARP 冲击下保持可用需专项验证',
        precondition: 'WEB/SNMP/SSH 客户端 + ARP 冲击工具',
        steps: ['常态核对 WEB/SNMP/SSH 可用', '大量 ARP 冲击下核对仍可用', '核对管理面响应'],
        expected: '外部管理连接始终保持可用'
      },
      {
        srs: '4.20.3', id: 'REL-003', name: '不存在内存泄漏', priority: 'P0',
        status: 'deferred', note: '需长时间运行观察内存曲线',
        precondition: '长时间运行',
        steps: ['长时间运行监控内存占用', '核对无持续增长', '核对无泄漏导致宕机'],
        expected: '无内存泄漏'
      },
      {
        srs: '4.20.4', id: 'REL-004', name: '自恢复能力', priority: 'P0',
        status: 'implemented', note: 'procd/watchdog，kernel panic/应用跑飞自动重启并恢复配置',
        precondition: '可制造进程/内核异常',
        steps: ['kill 关键进程核对拉起', '触发 panic 核对自动重启', '重启后核对配置恢复'],
        expected: '软件异常自恢复并恢复配置'
      },
      {
        srs: '4.20.5', id: 'REL-005', name: '异常掉电', priority: 'P0',
        status: 'deferred', note: 'FLASH/overlay 不损坏、正常启动并导入配置，需专项验证',
        precondition: '可控制断电',
        steps: ['运行中异常断电', '重新上电核对启动与配置', '反复掉电核对 FLASH 正常'],
        expected: '异常掉电后正常启动并导入配置'
      },
      {
        srs: '4.20.6', id: 'REL-006', name: '异常配置文件导入', priority: 'P1',
        status: 'implemented', note: '识别异常配置后不导入，保证系统正常',
        precondition: '构造异常/损坏配置文件',
        steps: ['导入异常配置文件', '核对设备识别并拒绝', '核对系统仍正常运行'],
        expected: '异常配置被识别并拒绝导入'
      },
      {
        srs: '4.20.7', id: 'REL-007', name: 'WEB/SNMP/CLI同时配置', priority: 'P1',
        status: 'implemented', note: '多重入配置不导致系统异常',
        precondition: '三通道同时操作',
        steps: ['WEB/SNMP/CLI 同时提交配置', '核对无异常与配置一致性', '核对日志'],
        expected: '多通道同时配置无异常'
      },
      {
        srs: '4.20.8', id: 'REL-008', name: '日志文件', priority: 'P1',
        status: 'implemented', note: 'RAM 环形缓冲，不出现磁盘写满',
        precondition: '持续产生日志',
        steps: ['长时间产生大量日志', '核对不写满磁盘', '核对设备无异常'],
        expected: '日志不会写满磁盘导致异常'
      }
    ]
  },
  {
    code: 'OPS',
    name: '运维',
    section: '4.21',
    requirements: [
      {
        srs: '4.21.1', id: 'OPS-001', name: '系统升级过程中异常断电能够正常启动并恢复用户配置', priority: 'P0',
        status: 'partial', note: '32M 双分区变体实现双槽位+回滚；16M 单分区无回滚；断电写入中断硬件验证待跑',
        precondition: '32M 双分区设备 + 可控制升级断电',
        steps: ['升级过程中断电', '核对仍能启动旧/新槽位', '核对用户配置恢复'],
        expected: '升级异常断电可正常启动并恢复配置（32M 变体）'
      }
    ]
  }
];
