import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { type Server, createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A local stand-in for what a Cloudflare Quick Tunnel does in front of the demo (tunnel mode):
 * it terminates TLS for the tunnel host and forwards each request over plain HTTP to the admin
 * listener's loopback port, as cloudflared does, keeping the Host header and appending the
 * visitor's address to X-Forwarded-For (Cloudflare's documented behaviour). It proves the
 * origin side (Host, Origin, __Host- cookies, CSRF, the SPA, CSP, the client address) without
 * the internet. It does NOT prove Cloudflare's own behaviour, its email sign-in
 * (--allowed-mail), or session lifetime: those are tested by the owner (runbook, Uji tunnel).
 *
 * The certificate is self-signed for the tunnel host, generated per run in a temporary folder
 * and deleted at teardown.
 */
export const EMULATED_VISITOR_ADDRESS = "198.51.100.23";

export function startEdge(host: string, listenPort: number, adminPort: number): Promise<Server> {
  const folder = mkdtempSync(join(tmpdir(), "solveit-demo-edge-"));
  const key = join(folder, "key.pem");
  const cert = join(folder, "cert.pem");

  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:P-256",
        "-nodes",
        "-days",
        "1",
        "-subj",
        `/CN=${host}`,
        "-addext",
        `subjectAltName=DNS:${host}`,
        "-keyout",
        key,
        "-out",
        cert,
      ],
      { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
    );
    const server = createServer(
      { key: readFileSync(key), cert: readFileSync(cert) },
      (incoming, outgoing) => {
        const headers = { ...incoming.headers };
        const forwarded = headers["x-forwarded-for"];
        headers["x-forwarded-for"] = forwarded
          ? `${String(forwarded)}, ${EMULATED_VISITOR_ADDRESS}`
          : EMULATED_VISITOR_ADDRESS;
        headers["x-forwarded-proto"] = "https";
        headers["cf-connecting-ip"] = EMULATED_VISITOR_ADDRESS;

        const upstream = httpRequest(
          {
            host: "127.0.0.1",
            port: adminPort,
            method: incoming.method,
            path: incoming.url,
            headers,
          },
          (answer) => {
            outgoing.writeHead(answer.statusCode ?? 502, answer.rawHeaders);
            answer.pipe(outgoing);
          },
        );
        upstream.on("error", () => {
          outgoing.writeHead(502);
          outgoing.end();
        });
        incoming.pipe(upstream);
      },
    );

    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(listenPort, "127.0.0.1", () => resolve(server));
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
