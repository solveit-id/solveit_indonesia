#!/usr/bin/env node
// Writes the admin console's browser security headers as nginx `add_header` directives for the
// production image (infra/docker/admin/Dockerfile, included by infra/docker/nginx/admin.conf).
// The values come from security-policy.ts, the one definition the dev server, the preview
// server, and the production HTML already use, so the HTTP headers cannot drift from them.
// Cache-Control is left out: admin.conf sets it per path (no-store, immutable hashed assets).
//
//   node scripts/write-nginx-headers.mjs <output file>
import { writeFileSync } from "node:fs";
import { contentSecurityPolicyHeader, securityHeaders } from "../security-policy.ts";

const output = process.argv[2];

if (!output) {
  console.error("usage: node scripts/write-nginx-headers.mjs <output file>");
  process.exit(1);
}

const headers = { ...securityHeaders, "Content-Security-Policy": contentSecurityPolicyHeader };
delete headers["Cache-Control"];

const lines = Object.entries(headers).map(([name, value]) => {
  // nginx would read `$` as a variable and `"` or `\` would end or escape the quoted value.
  if (!/^[A-Za-z0-9-]+$/.test(name) || /["\\$\n\r]/.test(value)) {
    throw new Error(`header ${name} cannot be written safely as an nginx directive`);
  }

  return `add_header ${name} "${value}" always;`;
});

writeFileSync(
  output,
  [
    "# Generated from admin/security-policy.ts by admin/scripts/write-nginx-headers.mjs. Do not edit.",
    ...lines,
    "",
  ].join("\n"),
);
console.log(`wrote ${lines.length} security headers to ${output}`);
