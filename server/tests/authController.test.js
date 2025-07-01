const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const { ERROR_CODES } = require("../errors");
const Session = require("../models/session");
const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const app = require("../app");

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
});

describe("POST /signout", () => {
  const sessionId = "test-auth-session-2";
  beforeAll(async () => {
    // Create another session for signout testing
    await Session.create({
      id: sessionId,
      user_id: jestVariables.userId,
    });

    await redisHelper.createSession(sessionId, {
      user_id: jestVariables.userId,
    });
  });

  it("Should clear session from database and Redis cache", async () => {
    await supertest(app)
      .post("/api/auth/signout")
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);

    const sessionInDB = await Session.getById(sessionId);
    expect(sessionInDB).toBeFalsy();

    const sessionInRedis = await redisHelper.getSession(sessionId);
    expect(sessionInRedis).toBeNull();
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
