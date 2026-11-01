---
name: cloud-firewall
description: Query, enable, and disable Alibaba Cloud Firewall (云防火墙) access control rules. Use when the user asks to list, view, query, enable, disable, or toggle Cloud Firewall rules, 访问控制策略, 云防火墙规则, or firewall policy rules on Alibaba Cloud.
---

# Cloud Firewall (云防火墙) Rules

Manage Alibaba Cloud Firewall access control policies (访问控制策略/规则). This skill covers **querying**, **enabling**, and **disabling** rules across the three Cloud Firewall types.

## Prerequisites

- Access to the Alibaba Cloud OpenAPI MCP server tools: `mcp__openapi_mcp_core__AlibabaCloud___CallCLI` (execute), `mcp__openapi_mcp_core__AlibabaCloud___SearchApis` (discover), `mcp__openapi_mcp_core__AlibabaCloud___GetApiDefinition` (inspect params).
- An Alibaba Cloud account with Cloud Firewall (`cloudfw`, API version `2017-12-07`) permissions, authorized via OAuth to the OpenAPI MCP server.

If you are unsure of an exact API or parameter, use `SearchApis` first to confirm, then `GetApiDefinition` to check required/optional parameters before calling. Do not guess required parameters.

## Execution model — commands run on Alibaba Cloud, NOT locally

**Important: `aliyun` CLI is NOT installed on the local machine.** Do not run `aliyun ...` in a local shell or assume it executes locally.

The `CallCLI` tool sends the `aliyun cloudfw ...` command string over HTTPS to **Alibaba Cloud's hosted OpenAPI MCP server** (`https://openapi-mcp.cn-hangzhou.aliyuncs.com/...`). That remote server executes the command with its own `aliyun` CLI and the account credentials you authorized via OAuth, then returns the JSON result over HTTPS.

Flow: local Pi → HTTPS + OAuth → Alibaba Cloud hosted MCP server → executes `aliyun cloudfw ...` in the cloud → JSON back to Pi.

Consequences:
- The command string you pass to `CallCLI` is what matters; the `aliyun` binary never needs to exist locally.
- The credentials are those of the Alibaba Cloud account bound to the MCP OAuth session, so operations act on that account.
- If a command fails with an MCP-level error (e.g. `unknown flag`), inspect via `GetApiDefinition` or `aliyun cloudfw <api> --help` (the `--help` request also goes through the remote server), then correct the call.

## Bundled scripts

Scripts live in `scripts/` (run them relative to this skill directory):

| Script | Purpose |
|---|---|
| `scripts/build-command.mjs` | Generate a correct `aliyun cloudfw ...` command string (right kebab-case flags, adds required pagination defaults). Feed the printed command into the `CallCLI` tool. |
| `scripts/format-rules.mjs` | Render a `Describe*ControlPolicy` / `*AclGroupList` JSON response into a readable table. Supports `--action`, `--state`, `--proto`, `--direction` filters and `--json`. |

Example pipeline (generate → execute → format):

```bash
node scripts/build-command.mjs list --direction in      # -> prints the aliyun command
# pass that command to CallCLI, save the JSON response to a file, then:
node scripts/format-rules.mjs response.json
# or pipe:  cat response.json | node scripts/format-rules.mjs --action drop
```

A sample response is in `tests/fixture-in.json` (use it to test the formatter: `node scripts/format-rules.mjs tests/fixture-in.json`).

## Firewall types

| Type | Scope | Query API | Modify API |
|---|---|---|---|
| **Internet Firewall** (互联网边界防火墙) | Public-facing ECS/SLB/NAT edges | `DescribeControlPolicy` | `ModifyControlPolicy` |
| **VPC Firewall** (VPC边界防火墙) | Traffic between VPCs / VBRs / CEN | `DescribeVpcFirewallControlPolicy` | `ModifyVpcFirewallControlPolicy` |
| **NAT Firewall** (NAT边界防火墙) | NAT gateway traffic | `DescribeNatFirewallControlPolicy` | `ModifyNatFirewallControlPolicy` |

All Cloud Firewall APIs use product code `cloudfw` and version `2017-12-07`.

## 1. Query rules

Query one or all firewall types. Always ask the user which type/scope they mean if it is not clear, or query all three and report which have rules.

### Internet Firewall — `DescribeControlPolicy`

`Direction` is required (must be `in` or `out`) unless querying by `AclUuid`. Query each direction separately.

```bash
aliyun cloudfw describe-control-policy --current-page 1 --page-size 100 --direction in
aliyun cloudfw describe-control-policy --current-page 1 --page-size 100 --direction out
```

Useful optional filters (all optional): `--source <cidr>`, `--destination <cidr|domain>`, `--proto TCP|UDP|ICMP|ANY`, `--acl-action accept|drop|log`, `--release true|false`, `--description <text>`, `--ip-version 4|6`, `--acl-uuid <id>`.

Response contains `TotalCount` and `Policys[]`. Each policy has: `AclUuid`, `AclName`/`Description`, `Direction`, `Order` (priority), `Source`/`SourceType`, `Destination`/`DestinationType`, `Proto`, `DestPort`/`DestPortType`, `AclAction` (`accept`/`drop`/`log`), `Release` (true=enabled, false=disabled), `HitTimes`, `ApplicationNameList`, `IpVersion`.

### VPC Firewall — `DescribeVpcFirewallControlPolicy`

First list the ACL groups to get `VpcFirewallId`:

```bash
aliyun cloudfw describe-vpc-firewall-acl-group-list --current-page 1 --page-size 100
```

Then query policies for a group (replace `<vpcFirewallId>`):

```bash
aliyun cloudfw describe-vpc-firewall-control-policy --current-page 1 --page-size 100 --vpc-firewall-id <vpcFirewallId>
```

### NAT Firewall — `DescribeNatFirewallControlPolicy`

First list the NAT firewalls to get `NatGatewayId`:

```bash
aliyun cloudfw describe-nat-firewall-acl-group-list --lang zh
```

Then query policies (replace `<natGatewayId>`):

```bash
aliyun cloudfw describe-nat-firewall-control-policy --current-page 1 --page-size 100 --nat-gateway-id <natGatewayId>
```

## 2. Enable / disable a rule

Enable/disable is done via the `Release` parameter on the corresponding **Modify** API:
- `Release: true` → 启用 (enable)
- `Release: false` → 禁用 (disable)

The rule's `AclUuid` is required (obtain it from the query APIs above).

### Internet Firewall — `ModifyControlPolicy`

```bash
# Enable
aliyun cloudfw modify-control-policy --acl-uuid <aclUuid> --release true
# Disable
aliyun cloudfw modify-control-policy --acl-uuid <aclUuid> --release false
```

### VPC Firewall — `ModifyVpcFirewallControlPolicy`

```bash
aliyun cloudfw modify-vpc-firewall-control-policy --vpc-firewall-id <vpcFirewallId> --acl-uuid <aclUuid> --release true
```

### NAT Firewall — `ModifyNatFirewallControlPolicy`

```bash
aliyun cloudfw modify-nat-firewall-control-policy --nat-gateway-id <natGatewayId> --acl-uuid <aclUuid> --release true
```

## Workflow

1. **Identify the target rule.** Ask the user for the rule name, description, or `AclUuid` if not given. If only a name is given, query the relevant firewall type and match by `AclName`/`Description`.
2. **Confirm the change.** Enable/disable is a write operation. Confirm the `AclUuid` and current `Release` state with the user, and state the effect (enable = traffic allowed to pass the rule; disable = rule no longer takes effect).
3. **Execute** the Modify API with `AclUuid` + `Release`. Optionally run a `--dry-run true` first to validate parameters without applying changes.
4. **Verify** by re-querying the rule and confirming `Release` now reflects the requested state. Report the result.

## Notes

- Only pass the parameters that are needed. For enable/disable, `AclUuid` + `Release` alone are sufficient — do not resend other policy fields (you may overwrite them otherwise).
- Use `--dry-run true` for a safe preflight check before real modifications.
- All rule states default to enabled (`Release: true`) on creation.
- If an API name or parameter is rejected, inspect with `aliyun cloudfw <api> --help` or `GetApiDefinition`, then correct the call.
