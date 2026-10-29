from mcp.server.fastmcp import FastMCP

from mcp_tools import MCPTools


tools = MCPTools.from_env()
mcp = FastMCP("402.fhe")


@mcp.tool()
def list_paid_apis():
    """List callable APIs with their public prices and routes."""
    return tools.list_paid_apis()


@mcp.tool()
def call_paid_api(api_id: str):
    """Call one paid API by ID after enforcing the configured price cap."""
    return tools.call_paid_api(api_id)


@mcp.tool()
def get_pending_usage():
    """Show unsettled usage recorded for the agent wallet."""
    return tools.get_pending_usage()


@mcp.tool()
def settle_usage():
    """Settle pending calls for the agent wallet in one contract batch."""
    return tools.settle_usage()


if __name__ == "__main__":
    mcp.run()
