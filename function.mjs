// Run the existing website and API at one HTTPS origin on a Neon Function.
import { Readable } from "node:stream";
import { handle } from "./server.mjs";
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const req = request.body ? Readable.fromWeb(request.body) : Readable.from([]);
    req.url = url.pathname + url.search;
    req.method = request.method;
    req.headers = { ...Object.fromEntries(request.headers), host: url.host };
    req.socket = { remoteAddress: undefined };
    const headers = new Headers();
    let result;
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(key, value) {
        headers.set(key, value);
      },
      writeHead(status, values = {}) {
        this.statusCode = status;
        for (const [key, value] of Object.entries(values)) headers.set(key, value);
        this.headersSent = true;
      },
      end(data) {
        result = new Response(data, { status: this.statusCode, headers });
      },
    };
    await handle(req, res);
    return result;
  },
};
