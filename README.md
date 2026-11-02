<div align="center">

# pi-cloud-firewall

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v1.0.1-blue.svg)
[![GitHub stars](https://img.shields.io/github/stars/pingdongyi/pi-cloud-firewall.svg)](https://github.com/pingdongyi/pi-cloud-firewall)
[![GitHub issues](https://img.shields.io/github/issues/pingdongyi/pi-cloud-firewall.svg)](https://github.com/pingdongyi/pi-cloud-firewall)

A [Pi](https://pi.dev) skill to manage **Alibaba Cloud Firewall (云防火墙)** access control rules: **query**, **enable**, and **disable**.

</div>

Install from Git:

```bash
pi install git:github.com/pingdongyi/pi-cloud-firewall@v1
```

Or locally:

```bash
pi install ./cloud-firewall-skill
```

Then load the skill in a session:

```
/skill:cloud-firewall
```

## What it does

Covers the three Alibaba Cloud Firewall types:

| Type | Query API | Enable/Disable API |
|---|---|---|
| Internet Firewall (互联网边界防火墙) | `DescribeControlPolicy` | `ModifyControlPolicy` |
| VPC Firewall (VPC边界防火墙) | `DescribeVpcFirewallControlPolicy` | `ModifyVpcFirewallControlPolicy` |
| NAT Firewall (NAT边界防火墙) | `DescribeNatFirewallControlPolicy` | `ModifyNatFirewallControlPolicy` |

Enable/disable is done via the `Release` parameter (`true` = enabled, `false` = disabled) with the rule's `AclUuid`.

## Bundled scripts

| Script | Purpose |
|---|---|
| `scripts/build-command.mjs` | Generate a correct `aliyun cloudfw ...` command (right kebab-case flags, required pagination defaults) to feed into the `CallCLI` tool. |
| `scripts/format-rules.mjs` | Render a `Describe*ControlPolicy` / `*AclGroupList` JSON response into a readable table, with `--action`/`--state`/`--proto`/`--direction` filters. |

## Requirements

- Pi with the [Alibaba Cloud OpenAPI MCP server](https://github.com/aliyun/alibabacloud-openapi-mcp-server) configured (this is Alibaba Cloud's hosted MCP endpoint, `https://openapi-mcp.cn-hangzhou.aliyuncs.com/...`).
- Alibaba Cloud account with Cloud Firewall (`cloudfw`) permissions, authorized to the MCP server via OAuth.
- `node` for the bundled scripts (no external dependencies).

> **The `aliyun` CLI is NOT installed on the local machine.** The `CallCLI` tool sends the command string over HTTPS to the Alibaba Cloud-hosted MCP server, which executes it in the cloud with the credentials of the authorized account. Never assume `aliyun ...` runs locally.

## License

MIT
