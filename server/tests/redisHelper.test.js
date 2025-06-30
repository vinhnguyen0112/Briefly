const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const { ERROR_CODES } = require("../errors");

describe("redisHelper", () => {
  const testAuthSessionId = "test-auth-session";
  const testAnonSessionId = "test-anon-session";

  const testAuthSessionData = {
    user_id: "test_user_id_1",
    query_count: 5,
    token_count: 10,
    maximum_response_length: 200,
    response_style: 2,
  };

  const testAnonSessionData = {
    anon_query_count: 3,
  };

  beforeAll(async () => {
    await redisCluster.connect();
  });

  afterAll(async () => {
    await redisCluster.quit();
  });

  afterEach(async () => {
    // clean up all test keys after each test
    const keys = await redisCluster.keys("*");
    if (keys.length > 0) {
      await redisCluster.del(keys);
    }
  });

  describe("createSession & getSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthSessionData);
    });

    it("should retrieve an authenticated session", async () => {
      const session = await redisHelper.getSession(testAuthSessionId);
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test_user_id_1");
    });

    it("should fail if session ID is missing", async () => {
      await expect(
        redisHelper.createSession(null, testAuthSessionData)
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("should fail if user_id is missing", async () => {
      await expect(
        redisHelper.createSession("bad-session", {
          ...testAuthSessionData,
          user_id: null,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshSession", () => {
    const key = `${process.env.REDIS_PREFIX}:auth:${testAuthSessionId}`;

    beforeEach(async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthSessionData);
      // Set session's TTL to 5 seconds
      await redisCluster.expire(key, 5);
    });

    it("Should refresh TTL of the authenticated session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(5);

      await redisHelper.refreshSession(testAuthSessionId);

      const ttlAfter = await redisCluster.ttl(key);

      expect(ttlAfter).toBeGreaterThan(
        parseInt(process.env.SESSION_TTL) - 1000
      );
    });

    it("Should have no effect if session is not found", async () => {
      await expect(
        redisHelper.refreshSession("nonexistent-session")
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthSessionData);
    });

    it("Should delete the session", async () => {
      await redisHelper.deleteSession(testAuthSessionId);
      const session = await redisHelper.getSession(testAuthSessionId);
      expect(session).toBeNull();
    });

    it("Should have no effect if session is not found", async () => {
      await expect(
        redisHelper.deleteSession("nonexistent-session")
      ).resolves.toBeUndefined();
    });
  });

  describe("createAnonSession & getAnonSession", () => {
    beforeEach(async () => {
      await redisHelper.createAnonSession(
        testAnonSessionId,
        testAnonSessionData
      );
    });

    it("Should retrieve the anonymous session", async () => {
      const session = await redisHelper.getAnonSession(testAnonSessionId);
      expect(session).toBeTruthy();
      expect(session.anon_query_count).toBe(3);
    });

    it("Should throw if session ID is missing", async () => {
      await expect(
        redisHelper.createAnonSession(null, testAnonSessionData)
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshAnonSession", () => {
    const key = `${process.env.REDIS_PREFIX}:anon:${testAnonSessionId}`;

    beforeEach(async () => {
      await redisHelper.createAnonSession(
        testAnonSessionId,
        testAnonSessionData
      );

      // Set session's TTL to 5 seconds
      await redisCluster.expire(key, 5);
    });

    it("Should refresh TTL of the anonymous session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(5);

      await redisHelper.refreshAnonSession(testAnonSessionId);

      const ttlAfter = await redisCluster.ttl(key);

      expect(ttlAfter).toBeGreaterThan(
        parseInt(process.env.SESSION_TTL) - 1000
      );
    });

    it("Should have no effect if anonymous session is not found", async () => {
      await expect(
        redisHelper.refreshAnonSession("nonexistent-anon-session")
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteAnonSession", () => {
    beforeEach(async () => {
      await redisHelper.createAnonSession(
        testAnonSessionId,
        testAnonSessionData
      );
    });

    it("Should delete an anonymous session successfully", async () => {
      redisHelper.deleteAnonSession(testAnonSessionId);
      const session = await redisHelper.getAnonSession(testAnonSessionId);
      expect(session).toBeNull();
    });

    it("Should have no effect if anonymous session is not found", async () => {
      await expect(
        redisHelper.deleteAnonSession("nonexistent-anon-session")
      ).resolves.toBeUndefined();
    });
  });

  describe("getAnySession", () => {
    const prefixedAuthSessionKey = `${process.env.REDIS_PREFIX}:auth:${testAuthSessionId}`;
    const prefixedAnonSessionKey = `${process.env.REDIS_PREFIX}:anon:${testAnonSessionId}`;
    const prefixedNonexistSessionKey = `${process.env.REDIS_PREFIX}:auth:non-exist`;
    beforeEach(async () => {
      await redisHelper.createSession(testAuthSessionId, testAuthSessionData);
      await redisHelper.createAnonSession(
        testAnonSessionId,
        testAnonSessionData
      );
    });

    it("Should retrieve the authenticated session by its full prefixed key", async () => {
      const session = await redisHelper.getAnySession(prefixedAuthSessionKey);
      expect(session).toBeTruthy();
      expect(session.data.user_id).toEqual(testAuthSessionData.user_id);
    });

    it("Should retrieve the anonymous session by its full prefixed key", async () => {
      const session = await redisHelper.getAnySession(prefixedAnonSessionKey);
      expect(session).toBeTruthy();
      expect(session.data.anon_query_count).toEqual(
        testAnonSessionData.anon_query_count
      );
    });

    it("Should return null if session doesn't exist", async () => {
      const session = await redisHelper.getAnySession(
        prefixedNonexistSessionKey
      );
      expect(session).toBeNull();
    });
  });
});
