const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const { ERROR_CODES } = require("../errors");
const { v4: uuidv4 } = require("uuid");
describe("redisHelper", () => {
  const testAuthSessionId = "redis-helper-test-auth-session";
  const testAnonSessionId = "redis-helper-test-anon-session";
  const userId = uuidv4();
  const testAuthSessionData = {
    user_id: userId,
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
    try {
      // for each master node in the cluster
      for (const node of redisCluster.masters) {
        const keys = [];
        const iter = node.scanIterator({
          MATCH: "*",
        });

        for await (const key of iter) {
          keys.push(key);
        }

        if (keys.length > 0) {
          await node.del(keys);
        }
      }
    } catch (err) {
      console.error("Error cleaning Redis keys after test:", err);
    }
  });

  describe("createSession & getSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(
        {
          id: testAuthSessionId,
          ...testAuthSessionData,
        },
        "auth"
      );
    });

    it("Should retrieve an authenticated session", async () => {
      const session = await redisHelper.getSession(testAuthSessionId, "auth");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe(userId);
    });

    it("Should fail if session ID is missing", async () => {
      await expect(
        redisHelper.createSession(
          {
            ...testAuthSessionData,
          },
          "auth"
        )
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("Should fail if user_id is missing", async () => {
      await expect(
        redisHelper.createSession(
          {
            id: "no_user_id_session",
            ...testAuthSessionData,
            user_id: null,
          },
          "auth"
        )
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("Should fail if provide unknown session type", async () => {
      await expect(
        redisHelper.createSession(
          {
            id: "unknown_session_type_session",
            ...testAuthSessionData,
            user_id: null,
          },
          "lmao"
        )
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("Should fail if doesn't provide session type", async () => {
      await expect(
        redisHelper.createSession({
          id: "unknown_session_type_session",
          ...testAuthSessionData,
          user_id: null,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshSession", () => {
    const key = `${process.env.REDIS_PREFIX}:auth:${testAuthSessionId}`;

    beforeEach(async () => {
      await redisHelper.createSession(
        {
          id: testAuthSessionId,
          ...testAuthSessionData,
        },
        "auth"
      );
      // Set session's TTL to 5 seconds
      await redisCluster.expire(key, 5);
    });

    it("Should refresh TTL of the authenticated session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(5);

      await redisHelper.refreshSession(testAuthSessionId, "auth");

      const ttlAfter = await redisCluster.ttl(key);

      expect(ttlAfter).toBeGreaterThan(
        parseInt(process.env.SESSION_TTL) - 1000
      );
    });

    it("Should have no effect if authenticated session is not found", async () => {
      await expect(
        redisHelper.refreshSession("nonexist-auth-session", "auth")
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(
        { id: testAuthSessionId, ...testAuthSessionData },
        "auth"
      );
    });

    it("Should delete the session", async () => {
      await redisHelper.deleteSession(testAuthSessionId, "auth");
      const session = await redisHelper.getSession(testAuthSessionId, "auth");
      expect(session).toBeNull();
    });

    it("Should have no effect if session is not found", async () => {
      await expect(
        redisHelper.deleteSession("nonexist-auth-session", "auth")
      ).resolves.toBeUndefined();
    });
  });

  describe("createAnonSession & getAnonSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(
        { id: testAnonSessionId, ...testAnonSessionData },
        "anon"
      );
    });

    it("Should retrieve the anonymous session", async () => {
      const session = await redisHelper.getSession(testAnonSessionId, "anon");
      expect(session).toBeTruthy();
      expect(session.anon_query_count).toBe(3);
    });

    it("Should throw if session ID is missing", async () => {
      await expect(
        redisHelper.createSession({ ...testAnonSessionData }, "anon")
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshAnonSession", () => {
    const key = `${process.env.REDIS_PREFIX}:anon:${testAnonSessionId}`;

    beforeEach(async () => {
      await redisHelper.createSession(
        { id: testAnonSessionId, ...testAnonSessionData },
        "anon"
      );

      // Set session's TTL to 5 seconds
      await redisCluster.expire(key, 5);
    });

    it("Should refresh TTL of the anonymous session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(5);

      await redisHelper.refreshSession(testAnonSessionId, "anon");

      const ttlAfter = await redisCluster.ttl(key);

      expect(ttlAfter).toBeGreaterThan(
        parseInt(process.env.SESSION_TTL) - 1000
      );
    });

    it("Should have no effect if anonymous session is not found", async () => {
      await expect(
        redisHelper.refreshSession("nonexistent-anon-session", "anon")
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteAnonSession", () => {
    beforeEach(async () => {
      await redisHelper.createSession(
        {
          id: testAnonSessionId,
          ...testAnonSessionData,
        },
        "anon"
      );
    });

    it("Should delete an anonymous session successfully", async () => {
      redisHelper.deleteSession(testAnonSessionId, "anon");
      const session = await redisHelper.getSession(testAnonSessionId, "anon");
      expect(session).toBeNull();
    });

    it("Should have no effect if anonymous session is not found", async () => {
      await expect(
        redisHelper.deleteSession("nonexistent-anon-session", "anon")
      ).resolves.toBeUndefined();
    });
  });
});
