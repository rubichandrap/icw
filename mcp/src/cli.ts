#!/usr/bin/env node
// CLI wrapper so scripts/CI can call the same logic without an MCP client.
import "dotenv/config";
import { verifyData } from "./lib/verify.js";
import { listIcwReports } from "./lib/fetcher.js";

const [cmd] = process.argv.slice(2);
switch (cmd) {
  case "verify": {
    const r = verifyData();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  case "list": {
    console.log(JSON.stringify(await listIcwReports(), null, 2));
    break;
  }
  default:
    console.error(`Usage: tsx mcp/src/cli.ts <verify|list>`);
    process.exit(2);
}
