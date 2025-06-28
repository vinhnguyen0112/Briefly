const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./jestVariables");
const { ERROR_CODES } = require("../errors");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const invalidAuthHeader = `Bearer auth:${jestVariables.invalidSessionId}`;
const malformedAuthHeader = `Bearer auth::${jestVariables.sessionId}`;

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
      .set("Authorization", invalidAuthHeader)
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
      .set("Authorization", invalidAuthHeader)
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
