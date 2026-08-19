#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { modules } from './srs-requirements.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/deliverable/testcases');

const STATUS_LABEL = {
  implemented: '已实现',
  partial: '部分实现',
  blocked: '受阻',
  deferred: '待验证',
  not: '未实现',
  unsupported: '不交付'
};

const cases = modules.flatMap((module) =>
  module.requirements.map((req) => ({ ...req, module }))
);

const total = cases.length;
const priorityCount = (p) => cases.filter((c) => c.priority === p).length;
const statusCount = (s) => cases.filter((c) => c.status === s).length;
const implementedCount = statusCount('implemented');
const partialCount = statusCount('partial');
const notCount = statusCount('not');
const deferredCount = statusCount('deferred');
const blockedCount = statusCount('blocked');

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function caseTable(requirements) {
  const head = '| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |';
  const sep = '| --- | --- | --- | --- | --- | --- | --- |';
  const rows = requirements.map((r) => {
    const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join('<br>');
    return `| ${r.id} | ${r.srs} | ${escapeCell(r.name)} | ${r.priority} | ${escapeCell(r.precondition)} | ${escapeCell(steps)} | ${escapeCell(r.expected)} |`;
  });
  return [head, sep, ...rows].join('\n');
}

function moduleMarkdown(module) {
  const lines = [
    `# ${module.name} 测试用例（SRS ${module.section}）`,
    '',
    `模块代码：\`${module.code}\`；需求条目：${module.requirements.length}。`,
    '',
    caseTable(module.requirements),
    ''
  ];
  return lines.join('\n');
}

function makeIndex() {
  const lines = [
    '# NEX905-F-40 测试用例（按模块）',
    '',
    '基线：`NEX905-F-40 软件需求规格说明书`（V1.0，CH26010012）第 4 章。',
    `需求条目：${total}；模块：${modules.length}。`,
    '',
    '## 模块文件',
    '',
    '| 模块 | 需求编号 | 文件 | 条目数 |',
    '| --- | --- | --- | ---: |'
  ];
  for (const m of modules) {
    lines.push(`| ${m.name} | ${m.section} | [${m.code.toLowerCase()}.md](${m.code.toLowerCase()}.md) | ${m.requirements.length} |`);
  }
  lines.push('', '## 覆盖口径', '',
    `- 需求设计覆盖率：${total}/${total}（100.0%）。每条 SRS 需求至少对应一个用例。`,
    `- P0：${priorityCount('P0')}；P1：${priorityCount('P1')}；P2：${priorityCount('P2')}。`,
    '- 本文档只定义测试方法、前置条件与预期结果，不包含产品实现状态、历史执行结果或通过率。', '',
    '## 公共要求', '',
    '1. 记录测试固件版本、SHA-256、设备序列号与端口连接拓扑。',
    '2. 破坏性、升级、攻击、容量与恢复出厂测试先备份配置并安排业务窗口。',
    '3. 执行方另行保存命令输出、抓包、日志、截图或机器报告，并在测试报告中记录判定。',
    '4. 每个用例执行后恢复临时账号、地址、路由、防火墙、SNMP、限速与测试服务。', '');
  return lines.join('\n');
}

function makeCombined() {
  const lines = ['# NEX905-F-40 需求测试用例（汇总）', '',
    '基线：`NEX905-F-40 软件需求规格说明书`（V1.0）。',
    `用例数量：${total}；模块：${modules.length}。`, '',
    '## 目录', ''];
  for (const m of modules) {
    lines.push(`- ${m.section} ${m.name}（${m.requirements.length}）`);
  }
  lines.push('', '## 公共要求', '',
    '1. 记录测试固件版本、SHA-256、设备序列号与端口连接拓扑。',
    '2. 破坏性测试先备份配置并安排业务窗口。',
    '3. 执行方保存命令输出、抓包、日志、截图或机器报告，并在测试报告中记录判定。',
    '4. 每个用例执行后恢复临时配置与服务。', '');
  for (const m of modules) {
    lines.push(`## ${m.section} ${m.name}（${m.requirements.length}）`, '');
    lines.push(caseTable(m.requirements), '');
  }
  return lines.join('\n');
}

function makeCoverage() {
  const lines = [
    '# NEX905-F-40 需求测试覆盖率',
    '',
    '统计日期：2026-08-14',
    `分母：SRS 第 4 章 ${total} 条需求。`,
    '',
    '## 总体覆盖率',
    '',
    '| 指标 | 分子/分母 | 覆盖率 |',
    '| --- | ---: | ---: |',
    `| 需求设计覆盖率 | ${total}/${total} | 100.0% |`,
    `| P0 用例数 | ${priorityCount('P0')} | - |`,
    `| P1 用例数 | ${priorityCount('P1')} | - |`,
    `| P2 用例数 | ${priorityCount('P2')} | - |`,
    '',
    '## 交付状态分布',
    '',
    '| 状态 | 数量 | 占比 |',
    '| --- | ---: | ---: |'
  ];
  for (const s of ['implemented', 'partial', 'deferred', 'blocked', 'not', 'unsupported']) {
    const n = statusCount(s);
    if (n > 0) lines.push(`| ${STATUS_LABEL[s]} | ${n} | ${(n * 100 / total).toFixed(1)}% |`);
  }
  lines.push('', '## 分类覆盖率', '',
    '| 模块 | 需求编号 | 已设计用例 | 覆盖率 |',
    '| --- | --- | ---: | ---: |');
  for (const m of modules) {
    lines.push(`| ${m.name} | ${m.section} | ${m.requirements.length}/${m.requirements.length} | 100.0% |`);
  }
  lines.push('', '## 统计边界', '',
    '- 需求设计覆盖率只说明用例已设计，不说明功能实现或测试通过。',
    '- 执行结果、证据路径与最终判定由测试执行方记录在独立测试报告中。', '');
  return lines.join('\n');
}

let topicCounter = 0;
function topic(title, children = []) {
  const result = { id: `topic-${String(++topicCounter).padStart(5, '0')}`, class: 'topic', title };
  if (children.length) result.children = { attached: children };
  return result;
}

function makeXmind() {
  const summary = topic('覆盖率摘要', [
    topic(`需求设计覆盖率：${total}/${total}（100.0%）`),
    topic(`交付状态：已实现 ${implementedCount}、部分 ${partialCount}、待验证 ${deferredCount}、受阻 ${blockedCount}、未实现 ${notCount}`),
    topic('仅表示测试设计覆盖，不表示产品实现或测试通过')
  ]);
  const env = topic('公共环境与通过标准', [
    topic('记录固件版本、SHA-256、设备身份、端口拓扑和测试时间'),
    topic('执行方另行保存命令、抓包、日志、截图或机器报告'),
    topic('破坏性测试先备份，结束后恢复临时配置和服务'),
    topic('性能与容量按实际数值判定，结果记录在独立测试报告中')
  ]);
  const moduleTopics = modules.map((m) =>
    topic(`${m.section} ${m.name}（${m.requirements.length}）`, m.requirements.map((r) =>
      topic(`${r.id} ${r.name}`, [
        topic(`优先级：${r.priority} / 交付状态：${STATUS_LABEL[r.status]}`),
        topic(`前置条件：${r.precondition}`),
        topic('操作步骤', r.steps.map((s, i) => topic(`${i + 1}. ${s}`))),
        topic(`预期结果：${r.expected}`)
      ])
    ))
  );
  const rootTopic = {
    id: 'root-nex905-srs-requirements',
    class: 'topic',
    title: `NEX905-F-40 需求测试用例（${total}）`,
    structureClass: 'org.xmind.ui.map',
    children: { attached: [summary, env, ...moduleTopics] }
  };
  return [{
    id: 'sheet-nex905-srs-requirements',
    class: 'sheet',
    title: 'NEX905-F-40 需求测试用例',
    rootTopic
  }];
}

function makeDeliveryBoundary() {
  const lines = [
    '# 7621 vrf evb 交付边界说明',
    '',
    '本机名称：`7621 vrf evb`（board_name `misectel,7621evb`），MT7621，256 MiB DDR3，16 MiB SPI NOR（另有 32M 双分区变体）。',
    '固件：ImmortalWrt `r37896-45f33e0f05`。',
    '本文件按《NEX905-F-40 软件需求规格说明书》(V1.0) 第 4 章逐条标注交付状态。',
    '',
    '## 1. 交付状态统计',
    '',
    '| 状态 | 数量 | 占比 |',
    '| --- | ---: | ---: |',
    `| 已实现 | ${implementedCount} | ${(implementedCount * 100 / total).toFixed(1)}% |`,
    `| 部分实现 | ${partialCount} | ${(partialCount * 100 / total).toFixed(1)}% |`,
    `| 待验证 | ${deferredCount} | ${(deferredCount * 100 / total).toFixed(1)}% |`,
    `| 受阻 | ${blockedCount} | ${(blockedCount * 100 / total).toFixed(1)}% |`,
    `| 未实现 | ${notCount} | ${(notCount * 100 / total).toFixed(1)}% |`,
    '',
    '## 2. 模块交付边界总览',
    '',
    '| 模块 | 需求编号 | 已实现 | 部分 | 待验证 | 受阻 | 未实现 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const m of modules) {
    const c = (s) => m.requirements.filter((r) => r.status === s).length;
    lines.push(`| ${m.name} | ${m.section} | ${c('implemented')} | ${c('partial')} | ${c('deferred')} | ${c('blocked')} | ${c('not')} |`);
  }
  lines.push('', '## 3. 逐条交付边界明细', '');
  for (const m of modules) {
    lines.push(`### ${m.section} ${m.name}`, '',
      '| 需求编号 | 需求 | 状态 | 说明 |',
      '| --- | --- | --- | --- |');
    for (const r of m.requirements) {
      lines.push(`| ${r.srs} | ${escapeCell(r.name)} | ${STATUS_LABEL[r.status]} | ${escapeCell(r.note)} |`);
    }
    lines.push('');
  }
  lines.push('## 4. 明确不交付 / 未实现清单', '',
    '- QoS 全部 6 条（调度模式、802.1P/DSCP、优先级叠加、CoS/DSCP/802.1P 映射）未交付。',
    '- 端口 MDIX 配置（AUTO/NORMAL/CROSS）、端口镜像、VLAN 优先级转发未交付。',
    '- NTP 身份鉴权（MD5/HMAC-SHA256/AES-CMAC）管理面未交付。',
    '- 完整 RMON（RFC 2819）四组、IEEE 802.3az EEE 配置未单独交付。',
    '',
    '## 5. 已知边界与风险', '',
    '- 性能：NAT 15Kpps 已通过；100Mbps 吞吐与 <1ms 时延未达（实测 94.78/94.76Mbps、1.222ms）。',
    '- SNMP Set：已实现（sysName/sysContact/sysLocation 经 VACM 写视图可写，snmpd.conf 使用 psys* 持久指令）。',
    '- RTC：PCF85063AT 驱动/节点已集成，但实机 I2C `0x51` 无 ACK（-145），本地时钟回退受阻，需硬件排查。',
    '- 可靠性：30*24H 长稳、大量 ARP 冲击、内存泄漏、异常掉电、32M 升级断电回滚等仍需专项实机验证。',
    '- 升级回滚仅 32M 双分区变体支持；16M 单分区升级断电无回滚能力。',
    '- 量产 MAC 需每台设备唯一写入；Factory/WOEM/LEDEINFO 未提供区域保持 `0xff`。', '');
  return lines.join('\n');
}

const boundaryPath = join(root, 'docs/deliverable/00-delivery-boundary.md');
writeFileSync(boundaryPath, makeDeliveryBoundary());

mkdirSync(outDir, { recursive: true });

for (const m of modules) {
  writeFileSync(join(outDir, `${m.code.toLowerCase()}.md`), moduleMarkdown(m));
}
writeFileSync(join(outDir, 'index.md'), makeIndex());
writeFileSync(join(outDir, 'all-testcases.md'), makeCombined());
writeFileSync(join(outDir, 'coverage.md'), makeCoverage());

const xmindPath = join(outDir, 'requirements-testcases.xmind');
const xmind = makeXmind();
const work = mkdtempSync(join(tmpdir(), 'misectel-srs-xmind-'));
try {
  writeFileSync(join(work, 'content.json'), `${JSON.stringify(xmind, null, 2)}\n`);
  writeFileSync(join(work, 'metadata.json'), `${JSON.stringify({
    creator: { name: 'opencode', version: '1.0' },
    activeSheetId: 'sheet-nex905-srs-requirements'
  }, null, 2)}\n`);
  writeFileSync(join(work, 'manifest.json'), `${JSON.stringify({
    'file-entries': {
      'content.json': { 'media-type': 'application/json' },
      'metadata.json': { 'media-type': 'application/json' }
    }
  }, null, 2)}\n`);
  const t = new Date('2026-08-14T00:00:00Z');
  for (const name of ['content.json', 'metadata.json', 'manifest.json'])
    utimesSync(join(work, name), t, t);
  rmSync(xmindPath, { force: true });
  execFileSync('zip', ['-q', '-X', '-9', xmindPath, 'content.json', 'metadata.json', 'manifest.json'], { cwd: work });
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(`requirements=${total}`);
console.log(`modules=${modules.length}`);
console.log(`implemented=${implementedCount}`);
console.log(`partial=${partialCount}`);
console.log(`deferred=${deferredCount}`);
console.log(`blocked=${blockedCount}`);
console.log(`not=${notCount}`);
console.log(`outDir=${outDir}`);
