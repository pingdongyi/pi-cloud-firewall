#!/usr/bin/env node
/**
 * build-command.mjs
 *
 * 生成正确的 `aliyun cloudfw ...` CLI 调用命令字符串（供传入 MCP 的 CallCLI 工具）。
 * 由于本地不一定装有 aliyun CLI，本脚本只生成命令、不执行。
 *
 * 用法:
 *   # 查询互联网防火墙规则 (入方向)
 *   node build-command.mjs list --direction in
 *   # 查询(带筛选)
 *   node build-command.mjs list --direction out --action accept --proto TCP
 *   # 查询 VPC / NAT 策略组
 *   node build-command.mjs groups --type vpc
 *   node build-command.mjs groups --type nat
 *   # 查询 VPC / NAT 具体规则
 *   node build-command.mjs list --type vpc --vpc-firewall-id <id>
 *   node build-command.mjs list --type nat --nat-gateway-id <id>
 *   # 启用 / 禁用 (互联网防火墙)
 *   node build-command.mjs enable  --acl-uuid <id>
 *   node build-command.mjs disable --acl-uuid <id>
 *   # 启用 / 禁用 (VPC / NAT)
 *   node build-command.mjs enable --type vpc --vpc-firewall-id <id> --acl-uuid <id>
 *   node build-command.mjs disable --type nat --nat-gateway-id <id> --acl-uuid <id>
 *   # 预检(不实际改动)
 *   node build-command.mjs disable --acl-uuid <id> --dry-run
 */

const args = process.argv.slice(2);
const op = args.shift();
const P = {}; // 参数表
const FLAGS = new Set(['dry-run', 'lang']); // 布尔/固定值开关

for (let i = 0; i < args.length; i++) {
  const m = args[i].match(/^--([a-z0-9-]+)(?:=(.+))?$/);
  if (!m) continue;
  const rawKey = m[1];
  if (FLAGS.has(rawKey)) {
    P[rawKey] = true;
  } else if (m[2] !== undefined) {
    P[toCamel(rawKey)] = m[2];
  } else {
    P[toCamel(rawKey)] = args[++i] || '';
  }
}

function toCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// 参数名映射: camelCase API 参数 -> CLI kebab-case flag
const PARAM_MAP = {
  direction: '--direction',
  pageSize: '--page-size',
  currentPage: '--current-page',
  aclUuid: '--acl-uuid',
  action: '--acl-action',
  proto: '--proto',
  source: '--source',
  destination: '--destination',
  sourceType: '--source-type',
  destinationType: '--destination-type',
  release: '--release',
  vpcFirewallId: '--vpc-firewall-id',
  natGatewayId: '--nat-gateway-id',
  ipVersion: '--ip-version',
  description: '--description',
  lang: '--lang',
};

function build(cmd) {
  let out = `aliyun cloudfw ${cmd}`;
  const keys = Object.keys(P).filter((k) => k !== 'type');
  for (const k of keys) {
    if (k === 'dry-run') { out += ' --dry-run true'; continue; }
    if (k === 'lang') { out += ' --lang zh'; continue; }
    const flag = PARAM_MAP[k];
    if (!flag) {
      console.error(`(警告) 未知参数: --${k}，已忽略`);
      continue;
    }
    out += ` ${flag} '${P[k]}'`;
  }
  return out;
}

let cmd;
switch (op) {
  case 'list':
    cmd = P.type === 'vpc' ? 'describe-vpc-firewall-control-policy'
        : P.type === 'nat' ? 'describe-nat-firewall-control-policy'
        : 'describe-control-policy';
    if (P.type !== 'vpc' && P.type !== 'nat' && !P.direction && !P.aclUuid) {
      console.error('错误: 查询互联网防火墙规则必须提供 --direction in|out 或 --acl-uuid');
      process.exit(1);
    }
    // 分页参数为必填，缺省补默认值
    if (P.currentPage === undefined) P.currentPage = '1';
    if (P.pageSize === undefined) P.pageSize = '100';
    console.log(build(cmd));
    break;
  case 'groups':
    cmd = P.type === 'nat' ? 'describe-nat-firewall-acl-group-list'
        : 'describe-vpc-firewall-acl-group-list';
    console.log(build(cmd));
    break;
  case 'enable':
  case 'disable':
    if (!P.aclUuid) {
      console.error('错误: 必须提供 --acl-uuid');
      process.exit(1);
    }
    P.release = op === 'enable' ? 'true' : 'false';
    cmd = P.type === 'vpc' ? 'modify-vpc-firewall-control-policy'
        : P.type === 'nat' ? 'modify-nat-firewall-control-policy'
        : 'modify-control-policy';
    console.log(build(cmd));
    break;
  default:
    console.error('用法: node build-command.mjs <list|groups|enable|disable> [参数...]');
    process.exit(1);
}
