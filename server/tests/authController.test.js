const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const { ERROR_CODES } = require("../errors");
const Session = require("../models/session");
const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const app = require("../app");
const AnonSession = require("../models/anonSession");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const anonHeader = `Bearer anon:${jestVariables.sessionId}`;
const nonexistAuthHeader = `Bearer auth:${jestVariables.invalidSessionId}`;
const malformedAuthHeader = `Bearer auth::${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisCluster.connect();
});

afterAll(async () => {
  await redisCluster.quit();
});

describe("POST /session-validate", () => {
  it("Should be success if provide valid session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if provide a non-exist session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", nonexistAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should fail if provide a malformed session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", malformedAuthHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if doesn't provide any session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", `Bearer `)
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should update cache if session is found in MariaDB but not Redis", async () => {
    const sessionId = "test-update-cache-auth-session-1";

    // Create a session in MariaDB
    await Session.create({ id: sessionId, user_id: jestVariables.userId });

    // Try to get session from Redis, which should be null
    expect(await redisHelper.getSession(sessionId, "auth")).toBeNull();

    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);

    expect(await redisHelper.getSession(sessionId, "auth")).toBeTruthy();
  });

  it("Should refresh session TTL in Redis and MariaDB if near expiry", async () => {
    const sessionId = "test-refresh-anon-session";
    const sessionKey = `${process.env.REDIS_PREFIX}:anon:${sessionId}`;

    // Create a session in MariaDB
    await AnonSession.create({
      id: sessionId,
      anon_query_count: 0,
    });

    // Create a session in Redis
    await redisHelper.createSession({ id: sessionId }, "anon");

    // Set TTL to expires in 10 secs
    await redisCluster.expire(sessionKey, 10);

    // Confirm short TTL
    let ttlBefore = await redisCluster.ttl(sessionKey);
    expect(ttlBefore).toBeLessThan(11);

    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", `Bearer anon:${sessionId}`)
      .expect(200);

    // Check TTL after refresh
    let ttlAfter = await redisCluster.ttl(sessionKey);
    // Should be close to defautl session's TTL (7 days)
    expect(ttlAfter).toBeGreaterThanOrEqual(
      parseInt(process.env.SESSION_TTL) - 10000
    );

    // Check session's expires_at in MariaDB
    const sessionInDb = await AnonSession.getById(sessionId);
    // Should be atleast 6 days from now on
    expect(new Date(sessionInDb.expires_at).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
  });
});

describe("POST /auth-only", () => {
  it("Should return success if a valid auth session is provided", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if a non-exist auth session is provided", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", nonexistAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should fail if provide a malformed auth session", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", malformedAuthHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if no auth session is provided", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should update cache if session is found in MariaDB but not Redis", async () => {
    const sessionId = "test-update-cache-auth-session-2";

    // Create a session in MariaDB
    await Session.create({ id: sessionId, user_id: jestVariables.userId });

    // Try to get session from Redis, which should be null
    expect(await redisHelper.getSession(sessionId, "auth")).toBeNull();

    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);

    expect(await redisHelper.getSession(sessionId, "auth")).toBeTruthy();
  });

  it("Should refresh session TTL in Redis and MariaDB if near expiry", async () => {
    const sessionId = "test-refresh-auth-session";
    const sessionKey = `${process.env.REDIS_PREFIX}:auth:${sessionId}`;

    // Create a session in MariaDB
    await Session.create({
      id: sessionId,
      user_id: jestVariables.userId,
    });

    // Create a short live session in Redis
    await redisHelper.createSession(
      { id: sessionId, user_id: jestVariables },
      "auth"
    );
    await redisCluster.expire(sessionKey, 10); // set TTL to 10 seconds to simulate near expiry

    // Confirm short TTL
    let ttlBefore = await redisCluster.ttl(sessionKey);
    expect(ttlBefore).toBeLessThan(11);

    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);

    // Check TTL after refresh
    let ttlAfter = await redisCluster.ttl(sessionKey);
    // Should be near default session's TTL (7 days)
    expect(ttlAfter).toBeGreaterThanOrEqual(
      parseInt(process.env.SESSION_TTL) - 10000 // 10 secs offset
    );

    // Check MariaDB expires_at after refresh
    const sessionInDb = await Session.getById(sessionId);
    // Should be atleast 6 days from now on
    expect(new Date(sessionInDb.expires_at).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
  });
});

describe("POST /signout", () => {
  // Create a session to test sign out
  const sessionId = "test-sign-out-auth-session";
  beforeAll(async () => {
    await Session.create({
      id: sessionId,
      user_id: jestVariables.userId,
    });

    await redisHelper.createSession(
      { id: sessionId, user_id: jestVariables.userId },
      "auth"
    );
  });

  it("Should clear session from database and Redis cache", async () => {
    await supertest(app)
      .post("/api/auth/signout")
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);

    expect(await Session.getById(sessionId)).toBeFalsy();

    expect(await redisHelper.getSession(sessionId, "auth")).toBeNull();
  });

  it("Should fail if trying to sign out an anonymous session", async () => {
    await supertest(app)
      .post("/api/auth/signout")
      .set("Authorization", anonHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
          },
        });
      });
  });

  it("Should fail if trying to sign out a non-exist session", async () => {
    await supertest(app)
      .post("/api/auth/signout")
      .set("Authorization", nonexistAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
          },
        });
      });
  });
});
