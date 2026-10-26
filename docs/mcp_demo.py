"""Calls the real Nigrani MCP server over stdio and records the transcript to docs/mcp_demo.md."""
import asyncio
import json
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    out = ["# Real MCP session against `nigrani.mcp_server` (stdio)\n"]
    async with stdio_client(StdioServerParameters(command=sys.executable, args=["-m", "nigrani.mcp_server"])) as (r, w), ClientSession(r, w) as s:
        await s.initialize(); tools = (await s.list_tools()).tools
        out.append("## tools/list\n" + "\n".join(f"- `{t.name}` — {t.description.splitlines()[0]}" for t in tools))
        a = json.loads((await s.call_tool("list_alerts", {"limit": 3})).content[0].text)
        a = a if isinstance(a, list) else [a]
        calls = [("list_alerts", {"limit": 3})]; aid = a[0]["alert_id"]; acc, dt = int(aid.split(":")[1]), aid.split(":")[0]
        calls += [("explain_alert", {"alert_id": aid}), ("get_counterparty_network", {"account": acc, "date": dt}), ("draft_case_note", {"alert_id": aid}), ("get_drift_report", {"top": 3})]
        for n, args in calls:
            res = (await s.call_tool(n, args)).content[0].text
            out.append(f"## tools/call `{n}` {json.dumps(args)}\n```\n{res[:1500]}\n```")
    open("docs/mcp_demo.md", "w").write("\n\n".join(out)); print("\n\n".join(out)[:3000])
asyncio.run(main())
