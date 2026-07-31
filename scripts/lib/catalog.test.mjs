import assert from "node:assert/strict";
import test from "node:test";

import { renderVersionsMarkdown } from "./catalog.mjs";

const generatedAt = "2026-03-25T00:00:00Z";

test("renderVersionsMarkdown links npm, pypi and github sources", () => {
  const catalog = {
    agents: [
      {
        target: "pi",
        image_name: "pi",
        automation: {
          enabled: true,
          source: { type: "npm", package: "@earendil-works/pi-coding-agent" },
        },
        tracked: {
          agent_version: "1.0.0",
          image_tag: "2026.03.1",
          last_updated: generatedAt,
        },
      },
      {
        target: "tau",
        image_name: "tau",
        automation: {
          enabled: true,
          source: { type: "pypi", package: "tau-ai" },
        },
        tracked: {
          agent_version: "0.3.3",
          image_tag: "2026.03.1",
          last_updated: generatedAt,
        },
      },
      {
        target: "agy",
        image_name: "agy",
        automation: {
          enabled: true,
          source: {
            type: "github_release",
            repo: "google-antigravity/antigravity-cli",
          },
        },
        tracked: {
          agent_version: "v0.1.0",
          image_tag: "2026.03.1",
          last_updated: generatedAt,
        },
      },
    ],
  };

  const markdown = renderVersionsMarkdown(catalog, generatedAt);

  assert.match(
    markdown,
    /\[npm:@earendil-works\/pi-coding-agent\]\(https:\/\/www\.npmjs\.com\/package\/@earendil-works\/pi-coding-agent\)/,
  );
  assert.match(
    markdown,
    /\[pypi:tau-ai\]\(https:\/\/pypi\.org\/project\/tau-ai\/\)/,
  );
  assert.match(
    markdown,
    /\[github:google-antigravity\/antigravity-cli\]\(https:\/\/github\.com\/google-antigravity\/antigravity-cli\/releases\/latest\)/,
  );
});
