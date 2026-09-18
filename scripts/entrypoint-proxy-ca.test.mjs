import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SYSTEM_BUNDLE = "/etc/ssl/certs/ca-certificates.crt";
const ENTRYPOINTS_WITH_PROXY_CA = [
  "docker/claude/entrypoint.sh",
  "docker/agy/entrypoint.sh",
];

const FAKE_CERT = [
  "-----BEGIN CERTIFICATE-----",
  "MIIFakeProxyCaCertLineUsedForGrepMatchingInTheEntrypoint",
  "-----END CERTIFICATE-----",
  "",
].join("\n");

async function extractSetupProxyCa(entrypoint) {
  const source = await readFile(
    new URL(`../${entrypoint}`, import.meta.url),
    "utf8",
  );
  const match = source.match(/^setup_proxy_ca\(\) \{\n[\s\S]*?^\}$/m);
  assert.ok(match, `${entrypoint} must define setup_proxy_ca()`);
  return match[0];
}

async function runSetupProxyCa(fn, { certFile, bundlePath }) {
  const body = bundlePath ? fn.replaceAll(SYSTEM_BUNDLE, bundlePath) : fn;
  const script = `${body}\nsetup_proxy_ca\n`;
  const { stdout, stderr } = await execFileAsync("sh", ["-euc", script], {
    env: { ...process.env, SSL_CERT_FILE: certFile },
  });
  return { stdout, stderr };
}

function systemBundleWritable() {
  try {
    accessSync(SYSTEM_BUNDLE, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

for (const entrypoint of ENTRYPOINTS_WITH_PROXY_CA) {
  test(`${entrypoint}: setup_proxy_ca stays silent when the system bundle is not writable`, async (t) => {
    if (systemBundleWritable()) {
      // Also guards against appending the fake cert to a real trust store.
      t.skip("requires an environment where the system bundle is read-only");
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), "proxy-ca-"));
    try {
      const certFile = join(dir, "mitmproxy-ca-cert.pem");
      await writeFile(certFile, FAKE_CERT);
      // Run verbatim against the real read-only system bundle, exactly like
      // rootless podman keep-id where USER_UID=0 but the process is not root.
      const { stderr } = await runSetupProxyCa(
        await extractSetupProxyCa(entrypoint),
        {
          certFile,
        },
      );
      assert.equal(
        stderr,
        "",
        "no 'Permission denied' noise on a read-only bundle",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test(`${entrypoint}: setup_proxy_ca appends the cert once to a writable bundle`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "proxy-ca-"));
    try {
      const certFile = join(dir, "mitmproxy-ca-cert.pem");
      const bundlePath = join(dir, "ca-certificates.crt");
      await writeFile(certFile, FAKE_CERT);
      await writeFile(bundlePath, "existing bundle contents\n");
      const fn = await extractSetupProxyCa(entrypoint);

      await runSetupProxyCa(fn, { certFile, bundlePath });
      const appended = await readFile(bundlePath, "utf8");
      assert.ok(appended.includes(FAKE_CERT), "cert appended on first run");

      await runSetupProxyCa(fn, { certFile, bundlePath });
      const rerun = await readFile(bundlePath, "utf8");
      assert.equal(rerun, appended, "cert not duplicated on second run");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test(`${entrypoint}: setup_proxy_ca skips a read-only bundle without failing`, async (t) => {
    if (process.getuid() === 0) {
      t.skip("root bypasses file mode checks");
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), "proxy-ca-"));
    try {
      const certFile = join(dir, "mitmproxy-ca-cert.pem");
      const bundlePath = join(dir, "ca-certificates.crt");
      await writeFile(certFile, FAKE_CERT);
      await writeFile(bundlePath, "existing bundle contents\n");
      await chmod(bundlePath, 0o444);
      const { stderr } = await runSetupProxyCa(
        await extractSetupProxyCa(entrypoint),
        {
          certFile,
          bundlePath,
        },
      );
      assert.equal(stderr, "", "no stderr noise on a read-only bundle");
      const untouched = await readFile(bundlePath, "utf8");
      assert.equal(
        untouched,
        "existing bundle contents\n",
        "read-only bundle unchanged",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
