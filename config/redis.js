import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL?.trim();

if (!redisUrl) {
  throw new Error("REDIS_URL is missing. Set it in backend/.env before starting the API.");
}

const redisClient = createClient({
  url: redisUrl,
  socket: {
    // Keep retrying when Redis is temporarily unreachable instead of taking
    // down the entire API process.
    reconnectStrategy: (retries) => Math.min(500 * 2 ** Math.min(retries, 6), 30_000),
  },
});

redisClient.on("error", (err) => {
  console.error("Redis client error:", err.message);
});

try {
  await redisClient.connect();
} catch (err) {
  // node-redis reconnects automatically after connect() has been initiated.
  // Let the API come up so non-session routes remain available during an
  // outage; Redis-backed session routes will recover when Redis reconnects.
  console.error("Could not connect to Redis during startup; reconnecting in the background:", err.message);
}

export default redisClient;
