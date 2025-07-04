const supertest = require("supertest");
const jestVariables = require("./jestVariables");

jest.mock("../helpers/dbHelper", () => ({
  executeQuery: jest
    .fn()
    .mockResolvedValue({ insertId: "mock-id", affectedRows: 1 }),
}));

jest.mock("../helpers/redisHelper", () => ({
  redisCluster: {
    connect: jest.fn().mockResolvedValue(true),
    quit: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("../middlewares/authMiddlewares", () => ({
  validateSession: (req, res, next) => {
    // Check if request has Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer auth:")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.session = { user_id: "test-user-789" };
    req.sessionType = "auth";
    next();
  },
  verifyOrigin: (req, res, next) => next(),
}));

// Mock other dependencies to prevent errors
jest.mock("../helpers/authHelper", () => ({
  extractFromAuthHeader: jest.fn().mockReturnValue("mock-token"),
  verifyGoogleToken: jest
    .fn()
    .mockResolvedValue({ userId: "test-user", name: "Test User" }),
  verifyFacebookToken: jest
    .fn()
    .mockResolvedValue({ userId: "test-user", name: "Test User" }),
}));

jest.mock("../models/user", () => ({
  create: jest.fn().mockResolvedValue(true),
  getById: jest.fn().mockResolvedValue({ id: "test-user", name: "Test User" }),
}));

jest.mock("../models/session", () => ({
  create: jest.fn().mockResolvedValue(true),
  getById: jest
    .fn()
    .mockResolvedValue({ id: "test-session", user_id: "test-user" }),
  delete: jest.fn().mockResolvedValue(1),
}));

jest.mock("../models/anonSession", () => ({
  create: jest.fn().mockResolvedValue(true),
  getById: jest.fn().mockResolvedValue({ id: "test-anon-session" }),
  delete: jest.fn().mockResolvedValue(1),
}));

const app = require("../app");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;

describe("POST /api/feedback", () => {
  /**
   * Test successful feedback submission with complete data
   */
  it("Should successfully submit feedback with valid data", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 5,
        comment: "Great service!",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("id");
        expect(response.body.id).toBeTruthy();
      });
  });

  /**
   * Test feedback submission with only stars rating
   */
  it("Should successfully submit feedback with only stars", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4 })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("id");
        expect(response.body.id).toBeTruthy();
      });
  });

  /**
   * Test authentication required - no authorization header
   */
  it("Should fail if no authentication provided", async () => {
    await supertest(app)
      .post("/api/feedback")
      .send({
        stars: 3,
        comment: "Anonymous feedback",
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Authentication required"
        );
      });
  });

  /**
   * Test authentication required - invalid authorization header
   */
  it("Should fail if invalid authentication provided", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", "Bearer invalid:token")
      .send({
        stars: 3,
        comment: "Invalid auth feedback",
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Authentication required"
        );
      });
  });

  /**
   * Test validation error when stars field is missing
   */
  it("Should fail if stars field is missing", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ comment: "Comment without stars" })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty("error", "Invalid stars");
      });
  });

  /**
   * Test validation error for stars value below minimum
   */
  it("Should fail if stars is less than 1", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 0, comment: "Invalid rating" })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty("error", "Invalid stars");
      });
  });

  /**
   * Test validation error for stars value above maximum
   */
  it("Should fail if stars is greater than 5", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 6, comment: "Invalid rating" })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty("error", "Invalid stars");
      });
  });

  /**
   * Test validation error for non-numeric stars value
   */
  it("Should fail if stars is not a number", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: "five", comment: "Invalid rating type" })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty("error", "Invalid stars");
      });
  });

  /**
   * Test validation error for decimal stars value
   */
  it("Should fail if stars is a decimal number", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4.5, comment: "Decimal rating" })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty("error", "Invalid stars");
      });
  });

  /**
   * Test boundary values for stars rating
   */
  it("Should accept boundary values 1 and 5 for stars", async () => {
    // Test minimum boundary
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 1, comment: "Minimum rating" })
      .expect(200);

    // Test maximum boundary
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 5, comment: "Maximum rating" })
      .expect(200);
  });

  /**
   * Test empty comment handling
   */
  it("Should accept empty comment", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 3, comment: "" })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  /**
   * Test long comment handling
   */
  it("Should accept long comments", async () => {
    const longComment = "A".repeat(1000);
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4, comment: longComment })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });
});
