import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loginToDockerHub,
  pushDescriptions,
} from "./push-hub-descriptions.mjs";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function writeOutput(root, target) {
  fs.mkdirSync(path.join(root, target), { recursive: true });
  fs.writeFileSync(
    path.join(root, target, "short-description.txt"),
    `${target} short`,
  );
  fs.writeFileSync(path.join(root, target, "overview.md"), `# ${target}\n`);
}

test("loginToDockerHub returns the JWT", async () => {
  const fetchImpl = async () => jsonResponse(200, { token: "jwt" });

  assert.equal(await loginToDockerHub("user", "token", fetchImpl), "jwt");
});

test("loginToDockerHub fails without a token in the response", async () => {
  const fetchImpl = async () => jsonResponse(401, { detail: "nope" });

  await assert.rejects(
    loginToDockerHub("user", "token", fetchImpl),
    /login failed \(HTTP 401\)/,
  );
});

test("pushDescriptions patches each repository and reports failures", async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hub-push-test-"));
  for (const target of ["claude", "junie", "codex"])
    writeOutput(outputRoot, target);

  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/junie/")) return jsonResponse(404, {});
    if (url.includes("/codex/")) return jsonResponse(403, { detail: "denied" });
    return jsonResponse(200, {});
  };

  const failures = await pushDescriptions({
    agents: [{ target: "claude" }, { target: "junie" }, { target: "codex" }],
    outputRoot,
    namespace: "vibepod",
    jwt: "jwt",
    fetchImpl,
  });

  assert.deepEqual(failures, ["codex"]);
  assert.equal(
    calls[0].url,
    "https://hub.docker.com/v2/repositories/vibepod/claude/",
  );
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.headers.Authorization, "JWT jwt");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    description: "claude short",
    full_description: "# claude\n",
  });
});
