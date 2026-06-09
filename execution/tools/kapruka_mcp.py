#!/usr/bin/env python3
"""
Kapruka MCP client — deterministic tool caller.

Usage:
  python3 kapruka_mcp.py <tool> '<args_json>'

Tools:
  search_products   {"q":"sports gift","limit":6}
  get_product       {"product_id":"cake00ka002034"}
  list_categories   {"depth":1}
  list_cities       {"query":"colombo"}
  check_delivery    {"city":"Colombo 03","delivery_date":"2026-06-15"}
  track_order       {"order_number":"VIMP34456CB2"}

Output: JSON to stdout. Exits 1 on error.
"""

import sys
import json
import httpx

MCP_URL = "https://mcp.kapruka.com/mcp"
BASE_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

TOOL_MAP = {
    "search_products":  "kapruka_search_products",
    "get_product":      "kapruka_get_product",
    "list_categories":  "kapruka_list_categories",
    "list_cities":      "kapruka_list_delivery_cities",
    "check_delivery":   "kapruka_check_delivery",
    "create_order":     "kapruka_create_order",
    "track_order":      "kapruka_track_order",
}


def get_session(client):
    resp = client.post(MCP_URL, headers=BASE_HEADERS, json={
        "jsonrpc": "2.0", "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "kapruka-agent", "version": "1.0"},
        },
    })
    resp.raise_for_status()
    session_id = resp.headers.get("mcp-session-id")
    if not session_id:
        raise RuntimeError("No session ID in initialize response")
    return session_id


def call_tool(client, session_id, tool_name, args):
    headers = {**BASE_HEADERS, "Mcp-Session-Id": session_id}
    # All tools wrap args in params + request JSON format
    arguments = {"params": {**args, "response_format": "json"}}

    resp = client.post(MCP_URL, headers=headers, json={
        "jsonrpc": "2.0", "id": 2,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
    })
    resp.raise_for_status()

    # Response is SSE: "event: message\ndata: {...}"
    for line in resp.text.splitlines():
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            if "error" in payload:
                raise RuntimeError(payload["error"].get("message", "MCP error"))
            result = payload.get("result", {})
            if result.get("isError"):
                content_text = result["content"][0]["text"] if result.get("content") else "Unknown error"
                raise RuntimeError(content_text)
            content = result.get("content", [])
            if content and content[0].get("type") == "text":
                text = content[0]["text"]
                # Parse JSON if response_format=json
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"raw": text}

    raise RuntimeError("Empty response from MCP server")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: kapruka_mcp.py <tool> '<args_json>'"}))
        sys.exit(1)

    short_name = sys.argv[1]
    tool_name  = TOOL_MAP.get(short_name, short_name)
    args       = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    try:
        with httpx.Client(timeout=20) as client:
            session_id = get_session(client)
            result     = call_tool(client, session_id, tool_name, args)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
