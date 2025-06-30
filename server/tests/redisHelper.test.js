const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

describe("redisHelper", () => {
  const testAuthSessionId = "test-auth-session";
  const testAnonSessionId = "test-anon-session";
  const testAuthData = {
    user_id: "user123",
    query_count: 5,
    token_count: 10,
    maximum_response_length: 200,
    response_style: 2,
  };
  const testAnonData = {
    anon_query_count: 3,
  };

  beforeAll(() => {
    redisCluster.connect();
  });

  afterAll(() => {
    redisCluster.quit();
  });

  describe("createSession & getSession", () => {
    it("Should create and retrieve an authenticated session", async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthData);
      const session = await redisHelper.getSession(testAuthSessionId);
      expect(session).toBeTruthy();
      expect(session.user_id).toBe(testAuthData.user_id);
      expect(session.query_count).toBe(testAuthData.query_count);
      expect(session.token_count).toBe(testAuthData.token_count);
      expect(session.maximum_response_length).toBe(
        testAuthData.maximum_response_length
      );
      expect(session.response_style).toBe(testAuthData.response_style);
      expect(typeof session.ttl).toBe("number");
    });

    it("Should fail if session ID is missing", async () => {
      await expect(
        redisHelper.createSession(null, testAuthData)
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("Should fail is user_id is missing", async () => {
      await expect(
        redisHelper.createSession("bad-session", {
          ...testAuthData,
          user_id: null,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshSession", () => {
    // TODO: Add a session with low TTL first
    it("Should refresh the TTL of an existing session", async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthData);
      await expect(
        redisHelper.refreshSession(testAuthSessionId)
      ).resolves.toBeUndefined();
    });

    it("Should have no effect if session doesn't exist", async () => {
      await expect(
        redisHelper.refreshSession("nonexistent-session")
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteSession", () => {
    it("should delete an authenticated session", async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthData);
      const deleted = await redisHelper.deleteSession(testAuthSessionId);
      expect(deleted).toBe(true);
      const session = await redisHelper.getSession(testAuthSessionId);
      expect(session).toBeNull();
    });
  });

  describe("createAnonSession & getAnonSession", () => {
    it("should create and retrieve an anonymous session", async () => {
      await redisHelper.createAnonSession(testAnonSessionId, testAnonData);
      const session = await redisHelper.getAnonSession(testAnonSessionId);
      expect(session).toBeTruthy();
      expect(session.anon_query_count).toBe(testAnonData.anon_query_count);
      expect(typeof session.ttl).toBe("number");
    });

    it("should throw if sessionId is missing", async () => {
      await expect(
        redisHelper.createAnonSession(null, testAnonData)
      ).rejects.toThrow(AppError);
    });
  });

  describe("refreshAnonSession", () => {
    it("should refresh the TTL of an existing anon session", async () => {
      await redisHelper.createAnonSession(testAnonSessionId, testAnonData);
      await expect(
        redisHelper.refreshAnonSession(testAnonSessionId)
      ).resolves.toBeUndefined();
    });

    it("should throw if anon session does not exist", async () => {
      await expect(
        redisHelper.refreshAnonSession("nonexistent-anon-session")
      ).rejects.toThrow(AppError);
    });
  });

  describe("deleteAnonSession", () => {
    it("should delete an anonymous session", async () => {
      await redisHelper.createAnonSession(testAnonSessionId, testAnonData);
      const deleted = await redisHelper.deleteAnonSession(testAnonSessionId);
      expect(deleted).toBe(true);
      const session = await redisHelper.getAnonSession(testAnonSessionId);
      expect(session).toBeNull();
    });
  });

  describe("getAnySession", () => {
    it("Should retrieve a session by prefixed key", async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthData);
      const key = process.env.REDIS_PREFIX
        ? `${process.env.REDIS_PREFIX}:auth:${testAuthSessionId}`
        : `auth:${testAuthSessionId}`;
      const session = await redisHelper.getAnySession(key);
      expect(session).toBeTruthy();
      expect(session.data.user_id).toBe(testAuthData.user_id);
    });

    it("should return null for non-existent key", async () => {
      const key = process.env.REDIS_PREFIX
        ? `${process.env.REDIS_PREFIX}:auth:does-not-exist`
        : "auth:does-not-exist";
      const session = await redisHelper.getAnySession(key);
      expect(session).toBeNull();
    });
  });
});
