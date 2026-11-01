#!/usr/bin/env node
/**
 * format-rules.mjs
 *
 * 将云防火墙 Describe*ControlPolicy 相关 API 的 JSON 响应渲染为可读表格。
 * 支持 DescribeControlPolicy / DescribeVpcFirewallControlPolicy /
 * DescribeNatFirewallControlPolicy 及 *AclGroupList 输出。
 *
 * 用法:
 *   # 从文件读取
 *   node format-rules.mjs response.json
 *   # 从 stdin 读取 (配合 CallCLI 输出)
 *   cat response.json | node format-rules.mjs
 *
 * 可选环境变量 / 参数:
 *   --action accept|drop|log   仅显示指定动作
 *   --state on|off             仅显示启用(on)/禁用(off)规则
 *   --proto TCP|UDP|ICMP|ANY  仅显示指定协议
 *   --direction in|out         仅显示指定方向
 *   --json                     输出原始 JSON (不格式化)
 *
 * 无外部依赖。
 */
import { readFileSync } from 'node:fs';
import { stdin } from 'node:process';

const args = process.argv.slice(2);
const filters = { action: null, state: null, proto: null, direction: null, json: false };
const positional = [];
const FLAG_KEYS = ['action', 'state', 'proto', 'direction'];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const m = a.match(/^--([a-z-]+)(?:=(.+))?$/);
  if (m && ['action', 'state', 'proto', 'direction', 'json'].includes(m[1])) {
    if (m[1] === 'json') {
      filters.json = true;
    } else if (m[2] !== undefined) {
      filters[m[1]] = m[2].toLowerCase();
    } else {
      // 取下一个参数作为值
      filters[m[1]] = (args[++i] || '').toLowerCase();
    }
  } else {
    positional.push(a);
  }
}

function readInput() {
  if (positional.length) return readFileSync(positional[0], 'utf8');
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => (data += c));
    stdin.on('end', () => resolve(data));
  });
}

// --- 解析各 API 的规则数组 ---
function extractRules(obj) {
  if (!obj || typeof obj !== 'object') return { kind: 'empty', rules: [] };
  const key = ['Policys', 'VpcFirewallPolicys', 'NatFirewallPolicys'].find((k) => Array.isArray(obj[k]));
  if (key) return { kind: key, rules: obj[key] };

  // 分组列表
  if (Array.isArray(obj.AclGroupList)) return { kind: 'AclGroupList', rules: obj.AclGroupList };
  if (Array.isArray(obj.VpcFirewalls)) return { kind: 'VpcFirewalls', rules: obj.VpcFirewalls };
  if (Array.isArray(obj.NatFirewalls)) return { kind: 'NatFirewalls', rules: obj.NatFirewalls };

  return { kind: 'other', rules: [] };
}

function fmtPort(r) {
  const t = r.DestPortType || 'port';
  if (t === 'group' && r.DestPortGroup) return `${r.DestPortGroup}(${(r.DestPortGroupPorts || []).join(',')})`;
  return r.DestPort || '0/0';
}

function state(r) {
  return String(r.Release).toLowerCase() === 'false' ? 'off' : 'on';
}

function actionLabel(a) {
  return { accept: '✅ 放行', drop: '⛔ 拒绝', log: '👁 观察' }[a] || a || '-';
}

function pad(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

function renderRules(rules, kind) {
  if (!rules.length) {
    console.log(`(空) ${kind} 无规则。`);
    return;
  }
  // 表头
  const cols = [
    ['Order', 5], ['Name', 18], ['Direction', 9], ['Source', 22], ['Destination', 22],
    ['Proto/Port', 26], ['Action', 9], ['State', 6], ['Hits', 9],
  ];
  const header = cols.map(([h, w]) => pad(h, w)).join(' ');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of rules) {
    const row = [
      [r.Order ?? '-', 5],
      [r.AclName || r.Description || r.Name || '-', 18],
      [r.Direction || '-', 9],
      [`${r.SourceType || ''}:${r.Source || '-'}`, 22],
      [`${r.DestinationType || ''}:${r.Destination || '-'}`, 22],
      [`${r.Proto || 'ANY'}/${fmtPort(r)}`, 26],
      [actionLabel(r.AclAction), 9],
      [state(r), 6],
      [r.HitTimes ?? '-', 9],
    ];
    console.log(row.map(([v, w]) => pad(v, w)).join(' '));
  }
}

function renderGroups(rules, kind) {
  if (!rules.length) {
    console.log(`(空) ${kind} 无策略组。`);
    return;
  }
  const header = pad('Name', 24) + pad('ID', 36) + pad('Region', 12) + pad('Rules', 8);
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const g of rules) {
    console.log(
      pad(g.Name || g.AclGroupName || g.NatGatewayName || '-', 24) +
      pad(g.AclGroupId || g.VpcFirewallId || g.NatGatewayId || g.VpcFirewallAclGroupId || '-', 36) +
      pad(g.RegionNo || g.Region || '-', 12) +
      pad(g.AclRuleCount ?? '-', 8)
    );
  }
}

// --- 过滤 ---
function applyFilters(rules) {
  return rules.filter((r) => {
    if (filters.action && (r.AclAction || '').toLowerCase() !== filters.action) return false;
    if (filters.state === 'on' && state(r) !== 'on') return false;
    if (filters.state === 'off' && state(r) !== 'off') return false;
    if (filters.proto && (r.Proto || '').toLowerCase() !== filters.proto) return false;
    if (filters.direction && (r.Direction || '').toLowerCase() !== filters.direction) return false;
    return true;
  });
}

const raw = await readInput();
const obj = JSON.parse(raw);

if (filters.json) {
  console.log(JSON.stringify(obj, null, 2));
} else {
  const { kind, rules } = extractRules(obj);
  if (kind === 'other') {
    console.log('无法识别的响应结构。可用 --json 查看原始内容。');
    console.log(JSON.stringify(obj, null, 2));
  } else {
    const filtered = applyFilters(rules);
    if (kind === 'AclGroupList' || kind === 'VpcFirewalls' || kind === 'NatFirewalls') {
      renderGroups(filtered, kind);
    } else {
      renderRules(filtered, kind);
    }
    if (filtered.length !== rules.length) {
      console.log(`\n(已按条件过滤 ${rules.length} -> ${filtered.length} 条)`);
    }
  }
}
