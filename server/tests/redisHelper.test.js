const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const { ERROR_CODES } = require("../errors");
const { v4: uuidv4 } = require("uuid");
describe("redisHelper", () => {
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

  // afterEach(async () => {
  //   try {
  //     // for each master node in the cluster
  //     for (const node of redisCluster.masters) {
  //       const keys = [];
  //       const iter = node.scanIterator({
  //         MATCH: "*",
  //       });

  //       for await (const key of iter) {
  //         keys.push(key);
  //       }

  //       if (keys.length > 0) {
  //         await node.del(keys);
  //       }
  //     }
  //   } catch (err) {
  //     console.error("Error cleaning Redis keys after test:", err);
  //   }
  // });

  describe("createSession & getSession", () => {
    const authSessionId = uuidv4();

    it("Should create an authenticated session", async () => {
      await expect(
        redisHelper.createSession(
          {
            id: authSessionId,
            ...testAuthSessionData,
          },
          "auth"
        )
      ).resolves.toBeUndefined();
    });

    it("Should retrieve an authenticated session", async () => {
      const session = await redisHelper.getSession(authSessionId, "auth");
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
            id: uuidv4(),
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
            id: uuidv4(),
            ...testAuthSessionData,
            user_id: null,
          },
          "lmao"
        )
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });

    it("Should fail if missing session type", async () => {
      await expect(
        redisHelper.createSession({
          id: uuidv4(),
          ...testAuthSessionData,
          user_id: null,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshSession", () => {
    const authSessionId = uuidv4();
    const key = `${process.env.REDIS_PREFIX}:auth:${authSessionId}`;

    beforeAll(async () => {
      await redisHelper.createSession(
        {
          id: authSessionId,
          ...testAuthSessionData,
        },
        "auth"
      );
      await redisCluster.expire(key, 10); // Set TTL to 10 seconds
    });

    it("Should refresh TTL of the authenticated session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(10);

      await redisHelper.refreshSession(authSessionId, "auth");

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
    const authSessionId = uuidv4();

    beforeAll(async () => {
      await redisHelper.createSession(
        { id: authSessionId, ...testAuthSessionData },
        "auth"
      );
    });

    it("Should delete the session", async () => {
      await redisHelper.deleteSession(authSessionId, "auth");
      const session = await redisHelper.getSession(authSessionId, "auth");
      expect(session).toBeNull();
    });

    it("Should have no effect if session is not found", async () => {
      await expect(
        redisHelper.deleteSession("nonexist-auth-session", "auth")
      ).resolves.toBeUndefined();
    });
  });

  describe("createAnonSession & getAnonSession", () => {
    const anonSessionId = uuidv4();

    it("Should create an anonymous session", async () => {
      await expect(
        redisHelper.createSession(
          { id: anonSessionId, ...testAnonSessionData },
          "anon"
        )
      ).resolves.toBeUndefined();
    });

    it("Should retrieve the anonymous session", async () => {
      const session = await redisHelper.getSession(anonSessionId, "anon");
      expect(session).toBeTruthy();
      expect(session.anon_query_count).toEqual(
        testAnonSessionData.anon_query_count
      );
    });

    it("Should throw if session ID is missing", async () => {
      await expect(
        redisHelper.createSession({ ...testAnonSessionData }, "anon")
      ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    });
  });

  describe("refreshAnonSession", () => {
    const anonSessionId = uuidv4();
    const key = `${process.env.REDIS_PREFIX}:anon:${anonSessionId}`;

    beforeAll(async () => {
      await redisHelper.createSession(
        { id: anonSessionId, ...testAnonSessionData },
        "anon"
      );

      // Set TTL to 10 seconds
      await redisCluster.expire(key, 10);
    });

    it("Should refresh TTL of the anonymous session", async () => {
      const ttlBefore = await redisCluster.ttl(key);
      expect(ttlBefore).toBeLessThanOrEqual(10);

      await redisHelper.refreshSession(anonSessionId, "anon");

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
    const anonSessionId = uuidv4();
    beforeAll(async () => {
      await redisHelper.createSession(
        {
          id: anonSessionId,
          ...testAnonSessionData,
        },
        "anon"
      );
    });

    it("Should delete an anonymous session successfully", async () => {
      redisHelper.deleteSession(anonSessionId, "anon");
      const session = await redisHelper.getSession(anonSessionId, "anon");
      expect(session).toBeNull();
    });

    it("Should have no effect if anonymous session is not found", async () => {
      await expect(
        redisHelper.deleteSession("nonexistent-anon-session", "anon")
      ).resolves.toBeUndefined();
    });
  });
});
