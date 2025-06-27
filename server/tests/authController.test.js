const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./jestVariables");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const invalidAuthHeader = `Bearer auth:${jestVariables.invalidSessionId}`;
const malformedAuthHeader = `Bearer aauth:${jestVariables.sessionId}`;

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

  it("Should fail if provide invalid session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", invalidAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("code");
        expect(response.body.error.code).toEqual("AUTH_SESSION_INVALID");
      });
  });

  it("Should fail if provide invalid session format in header", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", malformedAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("code");
        expect(response.body.error.code).toEqual(
          "SESSION_HEADER_FORMAT_INVALID"
        );
      });
  });

  it("Should fail if doesn't provide any session", async () => {
    await supertest(app)
      .post("/api/auth/session-validate")
      .set("Authorization", `Bearer `)
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("code");
        expect(response.body.error.code).toEqual("MISSING_SESSION_ID");
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

  it("Should fail if a invalid auth session is provided", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", invalidAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("code");
        expect(response.body.error.code).toEqual("AUTH_SESSION_INVALID");
      });
  });

  it("Should fail if a malformed auth session is provided", async () => {
    await supertest(app)
      .post("/api/auth/auth-only")
      .set("Authorization", malformedAuthHeader)
      .expect(401)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("code");
        expect(response.body.error.code).toEqual(
          "SESSION_HEADER_FORMAT_INVALID"
        );
      });
  });
});
