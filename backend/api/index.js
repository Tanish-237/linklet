// Vercel Function entrypoint. backend/vercel.json rewrites every path here, so
// one function serves the REST API (/api/v1/*, /health) and the Socket.IO
// WebSocket endpoint (/socket.io/*). Vercel calls into the exported HTTP server
// directly — it is never .listen()ed. The rewrite keeps the original URL in
// req.url, so Express routes and Socket.IO's default path match unchanged.
//
// WebSocket connections close when the function hits maxDuration (vercel.json);
// socket.io-client reconnects on its own and SocketContext re-registers.
import http from "http";
import app from "../src/app.js";
import { connectServices } from "../src/bootstrap.js";
import { initializeSocket } from "../socket.js";

const server = http.createServer(app);

// Cold start: connect MongoDB + Redis, then attach Socket.IO (its Redis adapter
// needs Redis up), before the first request or upgrade is handled. If this
// throws, the instance fails to initialize and the next request gets a fresh one.
await connectServices();
await initializeSocket(server);

export default server;
