// @vitest-environment node
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { parseAdminCredentials, serializeEnvironment } from "./environment-format.mjs";

describe("sanitized administrator stdin credentials", () => {
  it("accepts a JSON password without changing quotes or backslashes", () => {
    const password = 'Synthetic!quote"back\\slash';
    expect(parseAdminCredentials(JSON.stringify({ password }))).toEqual({ password });
  });

  it.each([
    '{password:"synthetic-secret-never-log"}', '{"password":"synthetic-secret-never-log", invalid}',
    '["synthetic-secret-never-log"]', '"synthetic-secret-never-log"', '{"password":123}', '{"password":null}',
    '{"password":{"nested":"synthetic-secret-never-log"}}', '{"password":["synthetic-secret-never-log"]}',
    '{"password":"short"}', '{"password":"synthetic-secret-never-log","username":"admin"}',
    '{"password":"synthetic-secret-never-log\\n"}', null, undefined, 123
  ])("rejects malformed or unsupported input without preserving the input %#", (input) => {
    try { parseAdminCredentials(input); throw new Error("Expected failure"); }
    catch (error) {
      expect(error.message).not.toBe("Expected failure");
      expect(error.message).not.toContain("synthetic-secret-never-log");
      expect(error.stack).not.toContain("synthetic-secret-never-log");
      expect(error).not.toHaveProperty("cause");
      expect(error).not.toHaveProperty("input");
      expect(error).not.toBeInstanceOf(SyntaxError);
    }
  });
});

describe("local dotenv serialization", () => {
  it.each([
    "Synthetic!plain-value", 'Synthetic!double"quote', "Synthetic!single'quote", "Synthetic!back`tick",
    "Synthetic!back\\slash", "Synthetic!literal\\nline", "Synthetic!literal\\rline", "Synthetic!hash#value",
    " Synthetic!spaces ", "Synthetic!both'\"quotes#hash", "Synthetic!all'\"`quotes", "Synthetic!Tiếng Việt",
    "", "#", "'", '"', "`", "\\", "=", " export-like=value "
  ])("roundtrips synthetic value %# exactly without JSON escape conversion", (password) => {
    const serialized = serializeEnvironment([["BOOTSTRAP_ADMIN_USERNAME", "admin"], ["BOOTSTRAP_ADMIN_PASSWORD", password]]);
    expect(parseEnv(serialized)).toEqual({ BOOTSTRAP_ADMIN_USERNAME: "admin", BOOTSTRAP_ADMIN_PASSWORD: password });
  });

  it("demonstrates why JSON stringification cannot write dotenv passwords", () => {
    for (const password of ['Synthetic!double"quote', "Synthetic!back\\slash", "Synthetic!literal\\nline"]) {
      expect(parseEnv(`FIXTURE=${JSON.stringify(password)}\n`).FIXTURE).not.toBe(password);
    }
  });

  it.each(["Synthetic!all'\"`quotes#hash", " Synthetic!all'\"`quotes ", "Synthetic!line\nvalue", "Synthetic!line\rvalue", "Synthetic!nul\0value"])("rejects an unsupported representation without exposing it %#", (password) => {
    try { serializeEnvironment([["BOOTSTRAP_ADMIN_PASSWORD", password]]); throw new Error("Expected failure"); }
    catch (error) {
      expect(error.message).not.toBe("Expected failure");
      expect(error.message).not.toContain(password);
      expect(error.stack).not.toContain(password);
    }
  });

  it("rejects invalid variable names without echoing input", () => {
    expect(() => serializeEnvironment([["BAD\nINJECT=secret", "fixture"]])).toThrow("Tên biến môi trường không hợp lệ.");
  });

  it("keeps serialization stable across repeated parse/save cycles", () => {
    const values = { FIXTURE: "Synthetic!both'\"quotes#hash", OTHER_FIXTURE: "Synthetic!back\\slash" };
    const once = serializeEnvironment(Object.entries(values));
    const twice = serializeEnvironment(Object.entries(parseEnv(once)));
    expect(twice).toBe(once);
  });
});
