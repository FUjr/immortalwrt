#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'docs/delivery-report.md');
const outputDir = join(root, 'docs/testcases');
const markdownPath = join(outputDir, '7621-nat-gateway-requirements-testcases.md');
const coveragePath = join(outputDir, '7621-nat-gateway-coverage.md');
const xmindPath = join(outputDir, '7621-nat-gateway-requirements-testcases.xmind');

const categoryDefinitions = {
  '标准协议': ['STD', '网关和两台支持目标速率的测试终端已连接', [
    '连接指定速率的以太网终端并确认链路建立',
    '读取 WAN/LAN 的协商速率、双工和 carrier 状态',
    '双向发送 ICMP 和 TCP 流量并检查丢包与错误计数'
  ]],
  '系统启动': ['BOOT', '串口日志和独立 Ping 采集端已就绪', [
    '设备断电至少 10 秒后重新上电并开始计时',
    '同步保存 U-Boot、内核和服务启动日志',
    '连续 Ping 管理地址，以首次稳定应答作为通信恢复时间'
  ]],
  'MAC': ['MAC', '至少两台终端可生成不同或重复 MAC 地址', [
    '按需求准备动态、静态、黑名单或超限 MAC 场景',
    '通过 Web/NMS 配置规则并产生二层流量',
    '分页查询 FDB、事件和端口状态，确认业务流量不被查询阻塞',
    '重启相关服务或设备，检查配置持久化和告警结果'
  ]],
  'IP 地址': ['IP', '管理主机同时具备 IPv4/IPv6 测试能力', [
    '通过 Web 和对应 NMS 接口提交目标网络配置',
    '验证地址、掩码、网关、ACL 或 IP-MAC 绑定生效',
    '执行合法与非法来源访问并核对日志',
    '重启网络和设备后复查持久化状态'
  ]],
  'DNS': ['DNS', '准备可控 DNS、NTP、Syslog 和管理域名', [
    '配置主备 DNS 或目标域名及缓存参数',
    '分别测试首次解析、重复解析、失效服务器和 IPv4/IPv6',
    '验证 NTP、日志或管理 HTTPS 的实际域名访问',
    '检查缓存时间、证书主机名和故障恢复'
  ]],
  '系统 WEB': ['WEB', '浏览器、管理员、运维和只读账号已准备', [
    '分别使用各角色登录 HTTPS 管理页',
    '验证允许与禁止的菜单、API 和敏感操作',
    '执行配置/日志导出、重启或恢复操作并记录确认流程',
    '检查会话、审计、错误提示和操作结果'
  ]],
  '固件升级': ['FWUP', '准备型号匹配和不匹配的固件及配置备份', [
    '通过指定 Web 或 NMS 通道上传固件',
    '核对型号、fwtool、大小和 SHA-256 校验',
    '执行保留配置升级并等待设备重新上线',
    '验证版本、配置、网络和失败镜像拒绝行为'
  ]],
  'CLI': ['CLI', '厂家调试账号和隔离管理网络已准备', [
    '使用 SSHv2 登录并确认旧协议不可用',
    '执行状态查询、配置备份恢复和批量脚本',
    '检查权限边界、退出码和日志',
    '确认调试入口未向普通用户开放'
  ]],
  'HTTPS/TLS': ['TLS', '具备 TLS 1.0-1.3 客户端和浏览器', [
    '分别发起 HTTP、TLS 1.0/1.1/1.2/1.3 连接',
    '核对 HTTP 跳转、证书链、协议和加密套件',
    '通过 HTTPS 执行升级、备份和实时状态读取',
    '验证弱协议、错误证书和未认证请求被拒绝'
  ]],
  '日志': ['LOG', '本地日志和远程 Syslog 接收器已准备', [
    '触发登录、配置、端口和安全关键事件',
    '查询并导出本地日志，核对时间和事件字段',
    '验证远程 Syslog、TLS、证书和目标白名单',
    '模拟接收端故障并检查业务不受阻塞'
  ]],
  'SNMP': ['SNMP', 'NMS 已安装 Net-SNMP 和交付 MIB', [
    '按需求启用对应 SNMP 版本和来源白名单',
    '执行 Get、GetNext、BulkGet，并对声明的可写 OID 执行 Set',
    '查询 MIB-II、IF-MIB、EtherLike-MIB 和 LLDP-MIB',
    '触发 Trap，核对 OID、变量、认证加密和恢复状态'
  ]],
  'SNMPv3': ['SNMPV3', 'NMS 支持 SHA-2 和 AES-256', [
    '创建 SNMPv3 authPriv 用户并限制管理源',
    '使用 SHA-256/AES-256 查询标准 MIB',
    '使用错误口令、弱算法和非白名单源执行反向测试',
    '抓包确认业务内容未以明文出现'
  ]],
  'NTP': ['NTP', '准备主、备、失效 NTP/SNTP 服务及 RTC 检测工具', [
    '配置多个时间源、优先级、域名和可选认证',
    '验证首次同步、偏移、活动服务器和 Web 状态',
    '停止主服务器并确认自动切换',
    '断开所有时间源，验证 RTC 回退和重启/掉电保持'
  ]],
  '管理运维': ['OPS', '设备可通过 Web 和厂家 CLI 管理', [
    '读取端口、流量、CPU、内存和进程状态',
    '停止重要进程并验证自动拉起或看门狗动作',
    '执行配置导入导出、升级和诊断命令',
    '核对结果、超时、日志和业务连续性'
  ]],
  '端口': ['PORT', 'WAN/LAN 测试端支持速率、双工和流控调整', [
    '通过 Web/NMS 设置速率、双工、流控、限速、开关或 MTU',
    '读取运行状态并与链路对端和内核状态交叉核对',
    '发送双向流量验证吞吐、丢包和 MTU 边界',
    '恢复自动协商并检查配置持久化'
  ]],
  'LLDP': ['LLDP', '至少接入一台第三方 LLDP 邻居', [
    '启用 LLDP 并配置参与接口和系统信息',
    '读取本地和远端 chassis、端口、类型及系统信息',
    '检查 Web 拓扑、LLDP-MIB 和 Syslog 上报',
    '断开/恢复邻居，验证拓扑更新和事件去重'
  ]],
  'ARP': ['ARP', '准备多个 IP/MAC 终端和持久化检查环境', [
    '创建、查询、更新和删除静态 ARP/绑定',
    '验证最大容量、分页、老化时间和 Proxy ARP',
    '制造 IP/MAC 冲突和重启场景',
    '核对邻居表、转发、防欺骗和配置持久化'
  ]],
  '路由': ['ROUTE', '上游和下游测试网段可控', [
    '配置需求数量的 IPv4 静态路由',
    '查询路由表并验证下一跳、优先级和持久化',
    '对首条、中间和末条路由执行双向流量测试',
    '删除和重启后确认路由状态符合配置'
  ]],
  'NAT': ['NAT', 'WAN 测试机和至少两个隔离 VRF 终端已准备', [
    '配置需求指定的主机、端口、网段、组播或源 NAT',
    '从 WAN 和 LAN/VRF 两侧分别建立新连接',
    '抓包核对源/目的地址、端口、校验和及 VRF 隔离',
    '执行容量、重载、性能和冲突配置回归'
  ]],
  'DHCP': ['DHCP', 'WAN DHCP 服务和至少一个 VRF DHCP 客户端已准备', [
    '配置 WAN Client 或每 VRF 地址池、网关、DNS 和静态租约',
    '释放并重新获取租约，核对下发内容',
    '验证多个 VRF、重复内网地址和静态 MAC 租约',
    '重载网络和重启设备后检查恢复'
  ]],
  'ACL': ['ACL', '准备多协议流量发生器和两个物理端口', [
    '创建 MAC、IPv4/IPv6、端口、ICMP、IGMP 或时间规则',
    '分别产生应允许、拒绝和重定向的流量',
    '核对计数器、物理出口、时间边界和日志',
    '验证冲突、环路和非法规则被拒绝'
  ]],
  '安全 MAC': ['SMAC', '至少准备 65 个可控源 MAC 或流量模拟器', [
    '配置端口 MAC 上限、静态允许列表和老化时间',
    '逐步增加合法、非法和超限 MAC 流量',
    '验证学习、告警、阻断/关断和事件记录',
    '解除违规并验证端口和业务恢复'
  ]],
  '网络安全': ['NETSEC', '隔离压测网络和受控攻击流量工具已准备', [
    '配置广播/多播、DoS、ARP/DHCP 或 Ping 防护策略',
    '先测无策略基线，再注入有界异常流量',
    '核对限速、阻断、日志、告警和合法业务',
    '比较启用前后吞吐、丢包、CPU 和延迟'
  ]],
  '告警统计': ['ALARM', '事件接收端、SNMP Trap 和流量发生器已准备', [
    '触发链路、带宽、广播/多播、CRC、Giant 或安全事件',
    '核对实时计数、阈值、日志和 Trap/Syslog',
    '验证事件时间、端口、严重级别和恢复通知',
    '重复触发以检查去重、分页和长期归档'
  ]],
  '快速诊断': ['DIAG', '准备正常链路和至少一种可控故障', [
    '读取端口状态、速率、双工和错误计数',
    '按时间、类型和关键字检索日志',
    '触发非法 MAC 或链路错误并追踪事件链',
    '核对查询延迟、分页完整性和业务影响'
  ]]
};

const priorityByKano = {
  '基本需求': 'P0',
  '期望需求': 'P1',
  '兴奋需求': 'P2',
  '无差异需求': 'P3'
};

function parseMatrix(markdown) {
  const start = markdown.indexOf('| 二级需求 | 初始需求（客户语言） |');
  const end = markdown.indexOf('\n## 5. 已知边界', start);
  if (start < 0 || end < 0)
    throw new Error('delivery requirement matrix was not found');

  return markdown.slice(start, end).split('\n').slice(2).filter((line) => line.startsWith('|')).map((line) => {
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
    if (cells.length !== 5)
      throw new Error(`invalid requirement row: ${line}`);
    return {
      category: cells[0],
      requirement: cells[1],
      kano: cells[2],
      implementation: Number(cells[3]),
      note: cells[4]
    };
  });
}

function executionState(row) {
  if (row.implementation === 0)
    return ['UNSUPPORTED', '当前版本明确不交付'];
  if (/无ACK|BLOCKED/i.test(row.note))
    return ['BLOCKED', row.note];
  if (/未达|不通过|FAIL/i.test(row.note))
    return ['FAIL', row.note];
  if (row.category === 'SNMP' && /Set/.test(row.requirement))
    return ['PARTIAL', row.note];
  if (/实机|实测|已测|验证|通过|Playwright|握手|返回/.test(row.note))
    return ['PASS', row.note];
  if (row.implementation === 1)
    return ['READY', `功能已实现；仍需按本用例完整执行。${row.note}`];
  return ['NOT_READY', `待开发或专项验收。${row.note}`];
}

function buildCases(rows) {
  const counters = {};
  return rows.map((row, index) => {
    const definition = categoryDefinitions[row.category];
    if (!definition)
      throw new Error(`missing category definition: ${row.category}`);
    const [prefix, precondition, steps] = definition;
    counters[prefix] = (counters[prefix] || 0) + 1;
    const id = `${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
    const [state, stateNote] = executionState(row);
    return {
      ...row,
      index: index + 1,
      id,
      priority: priorityByKano[row.kano] || 'P2',
      precondition,
      steps,
      expected: row.requirement,
      executionState: state,
      executionNote: stateNote
    };
  });
}

function percent(value, total) {
  return total ? `${(value * 100 / total).toFixed(1)}%` : '0.0%';
}

function summarize(cases) {
  const countBy = (key) => Object.fromEntries([...new Set(cases.map((item) => item[key]))].sort().map((value) => [
    value, cases.filter((item) => item[key] === value).length
  ]));
  const execution = countBy('executionState');
  const executed = ['PASS', 'FAIL', 'PARTIAL', 'BLOCKED'].reduce((sum, key) => sum + (execution[key] || 0), 0);
  return {
    total: cases.length,
    categories: new Set(cases.map((item) => item.category)).size,
    priorities: countBy('priority'),
    kano: countBy('kano'),
    implementation: countBy('implementation'),
    execution,
    executed,
    pass: execution.PASS || 0
  };
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function makeMarkdown(cases, summary) {
  const groups = [...new Set(cases.map((item) => item.category))];
  const lines = [
    '# Misectel 7621EVB 需求测试用例', '',
    '基线：`docs/requirements.md` 与 `docs/delivery-report.md` 客户需求矩阵。',
    `用例数量：${summary.total}；需求分类：${summary.categories}。`, '',
    '## 覆盖口径', '',
    `- 需求设计覆盖率：${summary.total}/${summary.total}（100.0%）。每条客户需求至少对应一个用例。`,
    `- 当前实现覆盖率：${summary.implementation[1] || 0}/${summary.total}（${percent(summary.implementation[1] || 0, summary.total)}）。该指标来自交付矩阵状态，不代表测试通过。`,
    `- 已有证据执行覆盖率：${summary.executed}/${summary.total}（${percent(summary.executed, summary.total)}）。仅统计交付矩阵明确写出实测、验证、失败、部分通过或硬件阻塞的条目。`,
    `- 已有证据通过覆盖率：${summary.pass}/${summary.total}（${percent(summary.pass, summary.total)}）。READY 不计为 PASS。`, '',
    '状态说明：PASS 已有通过证据；FAIL 已执行但未达需求；PARTIAL 部分通过；BLOCKED 已执行但被硬件阻塞；READY 已实现待完整回归；NOT_READY 待开发/专项验收；UNSUPPORTED 当前不交付。', '',
    '## 公共要求', '',
    '1. 测试固件、配置和硬件拓扑必须记录版本、SHA-256、设备序列号和端口连接。',
    '2. 破坏性、升级、攻击、容量和恢复出厂测试必须先备份配置并安排业务窗口。',
    '3. PASS 必须保存命令输出、抓包、日志、截图或机器生成报告；只有源码或页面存在时标记 READY。',
    '4. 每个用例执行后恢复临时账号、地址、路由、防火墙、SNMP、限速和测试服务。', ''
  ];

  for (const group of groups) {
    const items = cases.filter((item) => item.category === group);
    lines.push(`## ${group}（${items.length}）`, '', '| ID | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 当前状态 |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const item of items) {
      const steps = item.steps.map((step, i) => `${i + 1}. ${step}`).join('<br>');
      lines.push(`| ${item.id} | ${escapeCell(item.requirement)} | ${item.priority} | ${escapeCell(item.precondition)} | ${escapeCell(steps)} | ${escapeCell(item.expected)} | ${item.executionState}：${escapeCell(item.executionNote)} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function makeCoverage(cases, summary) {
  const implementation = summary.implementation;
  const executionOrder = ['PASS', 'FAIL', 'PARTIAL', 'BLOCKED', 'READY', 'NOT_READY', 'UNSUPPORTED'];
  const lines = [
    '# Misectel 7621EVB 需求测试覆盖率', '',
    '统计日期：2026-08-06',
    '分母：`docs/delivery-report.md` 需求实现矩阵中的 100 条客户需求。', '',
    '## 总体覆盖率', '',
    '| 指标 | 分子/分母 | 覆盖率 | 解释 |',
    '| --- | ---: | ---: | --- |',
    `| 需求设计覆盖率 | ${summary.total}/${summary.total} | 100.0% | 每条需求均生成测试用例 |`,
    `| P0 基本需求设计覆盖率 | ${summary.priorities.P0 || 0}/${summary.kano['基本需求'] || 0} | ${percent(summary.priorities.P0 || 0, summary.kano['基本需求'] || 0)} | 基本需求全部有用例 |`,
    `| 当前实现覆盖率 | ${implementation[1] || 0}/${summary.total} | ${percent(implementation[1] || 0, summary.total)} | 状态 1，不等同实测 PASS |`,
    `| 已有证据执行覆盖率 | ${summary.executed}/${summary.total} | ${percent(summary.executed, summary.total)} | 只统计明确执行证据 |`,
    `| 已有证据通过覆盖率 | ${summary.pass}/${summary.total} | ${percent(summary.pass, summary.total)} | READY 不计入通过 |`,
    `| 已执行用例通过率 | ${summary.pass}/${summary.executed} | ${percent(summary.pass, summary.executed)} | 仅在已有执行证据内计算 |`, '',
    '## 需求基线分布', '',
    '| 维度 | 数量 |', '| --- | ---: |',
    `| 基本需求/P0 | ${summary.kano['基本需求'] || 0} |`,
    `| 期望需求/P1 | ${summary.kano['期望需求'] || 0} |`,
    `| 兴奋需求/P2 | ${summary.kano['兴奋需求'] || 0} |`,
    `| 无差异需求/P3 | ${summary.kano['无差异需求'] || 0} |`,
    `| 状态 1（当前实现） | ${implementation[1] || 0} |`,
    `| 状态 2（待开发/专项验收） | ${implementation[2] || 0} |`,
    `| 状态 0（不交付） | ${implementation[0] || 0} |`, '',
    '## 执行状态分布', '',
    '| 状态 | 数量 | 是否计入执行覆盖 |', '| --- | ---: | --- |'
  ];
  for (const state of executionOrder)
    lines.push(`| ${state} | ${summary.execution[state] || 0} | ${['PASS', 'FAIL', 'PARTIAL', 'BLOCKED'].includes(state) ? '是' : '否'} |`);

  lines.push('', '## 未闭环重点', '');
  for (const item of cases.filter((item) => ['FAIL', 'PARTIAL', 'BLOCKED', 'NOT_READY', 'UNSUPPORTED'].includes(item.executionState)))
    lines.push(`- \`${item.id}\` ${item.requirement}：${item.executionState}，${item.executionNote}`);

  lines.push('', '## 统计边界', '',
    '- 需求设计覆盖率只说明用例已经设计，不说明功能实现或测试通过。',
    '- 当前实现覆盖率直接采用交付矩阵的 0/1/2 状态。',
    '- 已有证据执行覆盖率采用保守口径；交付矩阵未明确写出执行证据的状态 1 条目仍记为 READY。',
    '- 后续执行用例时应回填证据路径和实际结果，再重新生成 XMind 与覆盖率报告。', '');
  return lines.join('\n').trimEnd();
}

let topicCounter = 0;
function topic(title, children = []) {
  const result = { id: `topic-${String(++topicCounter).padStart(5, '0')}`, class: 'topic', title };
  if (children.length)
    result.children = { attached: children };
  return result;
}

function makeXmind(cases, summary) {
  const groups = [...new Set(cases.map((item) => item.category))];
  const summaryTopic = topic('覆盖率摘要', [
    topic(`需求设计覆盖率：${summary.total}/${summary.total}（100.0%）`),
    topic(`当前实现覆盖率：${summary.implementation[1] || 0}/${summary.total}（${percent(summary.implementation[1] || 0, summary.total)}）`),
    topic(`已有证据执行覆盖率：${summary.executed}/${summary.total}（${percent(summary.executed, summary.total)}）`),
    topic(`已有证据通过覆盖率：${summary.pass}/${summary.total}（${percent(summary.pass, summary.total)}）`),
    topic('READY 仅表示已实现待回归，不计为 PASS')
  ]);
  const environmentTopic = topic('公共环境与通过标准', [
    topic('记录固件版本、SHA-256、设备身份、端口拓扑和测试时间'),
    topic('PASS 必须附命令、抓包、日志、截图或机器报告'),
    topic('破坏性测试先备份，结束后恢复临时配置和服务'),
    topic('性能和容量按实际数值判定，不以实现状态替代测试结果')
  ]);

  const categoryTopics = groups.map((group) => {
    const items = cases.filter((item) => item.category === group);
    return topic(`${group}（${items.length}）`, items.map((item) => topic(`${item.id} ${item.requirement}`, [
      topic(`优先级：${item.priority} / ${item.kano}`),
      topic(`实现基线：${item.implementation} / ${item.note}`),
      topic(`前置条件：${item.precondition}`),
      topic('操作步骤', item.steps.map((step, i) => topic(`${i + 1}. ${step}`))),
      topic(`预期结果：${item.expected}`),
      topic(`当前状态：${item.executionState} / ${item.executionNote}`)
    ])));
  });

  const rootTopic = {
    id: 'root-misectel-7621-requirements',
    class: 'topic',
    title: `Misectel 7621EVB 需求测试用例（${summary.total}）`,
    structureClass: 'org.xmind.ui.logic.right',
    children: { attached: [summaryTopic, environmentTopic, ...categoryTopics] }
  };
  return [{
    id: 'sheet-misectel-7621-requirements',
    class: 'sheet',
    title: 'Misectel 7621EVB 需求测试用例',
    rootTopic
  }];
}

function extractIdsFromTopics(node, ids = []) {
  const match = /^(?:STD|BOOT|MAC|IP|DNS|WEB|FWUP|CLI|TLS|LOG|SNMP|SNMPV3|NTP|OPS|PORT|LLDP|ARP|ROUTE|NAT|DHCP|ACL|SMAC|NETSEC|ALARM|DIAG)-\d{3}\b/.exec(node.title || '');
  if (match)
    ids.push(match[0]);
  for (const child of node.children?.attached || [])
    extractIdsFromTopics(child, ids);
  return ids;
}

const rows = parseMatrix(readFileSync(sourcePath, 'utf8'));
if (!rows.length)
  throw new Error('no customer requirements were parsed');
const cases = buildCases(rows);
const summary = summarize(cases);
const markdown = makeMarkdown(cases, summary);
const coverage = makeCoverage(cases, summary);
const xmind = makeXmind(cases, summary);

mkdirSync(outputDir, { recursive: true });
writeFileSync(markdownPath, markdown);
writeFileSync(coveragePath, `${coverage}\n`);

const work = mkdtempSync(join(tmpdir(), 'misectel-xmind-'));
try {
  writeFileSync(join(work, 'content.json'), `${JSON.stringify(xmind, null, 2)}\n`);
  writeFileSync(join(work, 'metadata.json'), `${JSON.stringify({
    creator: { name: 'Codex', version: '1.0' },
    activeSheetId: 'sheet-misectel-7621-requirements'
  }, null, 2)}\n`);
  writeFileSync(join(work, 'manifest.json'), `${JSON.stringify({
    'file-entries': {
      'content.json': { 'media-type': 'application/json' },
      'metadata.json': { 'media-type': 'application/json' }
    }
  }, null, 2)}\n`);
  const archiveTime = new Date('2026-08-06T00:00:00Z');
  for (const name of ['content.json', 'metadata.json', 'manifest.json'])
    utimesSync(join(work, name), archiveTime, archiveTime);
  rmSync(xmindPath, { force: true });
  execFileSync('zip', ['-q', '-X', '-9', xmindPath, 'content.json', 'metadata.json', 'manifest.json'], { cwd: work });
} finally {
  rmSync(work, { recursive: true, force: true });
}

const markdownIds = [...markdown.matchAll(/\| ((?:STD|BOOT|MAC|IP|DNS|WEB|FWUP|CLI|TLS|LOG|SNMP|SNMPV3|NTP|OPS|PORT|LLDP|ARP|ROUTE|NAT|DHCP|ACL|SMAC|NETSEC|ALARM|DIAG)-\d{3}) \|/g)].map((match) => match[1]);
const xmindIds = extractIdsFromTopics(xmind[0].rootTopic);
if (JSON.stringify(markdownIds) !== JSON.stringify(xmindIds))
  throw new Error('Markdown and XMind case IDs do not match');

console.log(`requirements=${summary.total}`);
console.log(`categories=${summary.categories}`);
console.log(`design_coverage=${percent(summary.total, summary.total)}`);
console.log(`implementation_coverage=${percent(summary.implementation[1] || 0, summary.total)}`);
console.log(`evidence_execution_coverage=${percent(summary.executed, summary.total)}`);
console.log(`evidence_pass_coverage=${percent(summary.pass, summary.total)}`);
console.log(`markdown=${markdownPath}`);
console.log(`xmind=${xmindPath}`);
console.log(`coverage=${coveragePath}`);
