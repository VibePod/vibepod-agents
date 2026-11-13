import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SCRIPT = fileURLToPath(
  new URL("../docker/warp/keyring-session.sh", import.meta.url),
);

// Stand-ins for the two daemons: each records how it was called, so the tests
// run without D-Bus or a keyring installed.
const FAKE_DBUS = `#!/bin/sh
echo "$*" > "$FAKE_LOG_DIR/dbus.args"
echo "unix:path=/fake/bus,guid=1234"
`;
const FAKE_KEYRING = `#!/bin/sh
echo "$*" > "$FAKE_LOG_DIR/keyring.args"
echo "$DBUS_SESSION_BUS_ADDRESS" > "$FAKE_LOG_DIR/keyring.bus"
od -An -c > "$FAKE_LOG_DIR/keyring.stdin"
exit "\${FAKE_KEYRING_EXIT:-0}"
`;
const PRINT_ENV =
  'echo "bus=$DBUS_SESSION_BUS_ADDRESS"; echo "runtime=$XDG_RUNTIME_DIR"';

async function withSandbox(run, { daemons = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "warp-keyring-"));
  const bin = join(dir, "bin");
  const home = join(dir, "home");
  await mkdir(bin);
  await mkdir(home);
  if (daemons) {
    for (const [name, body] of [
      ["dbus-daemon", FAKE_DBUS],
      ["gnome-keyring-daemon", FAKE_KEYRING],
    ]) {
      await writeFile(join(bin, name), body);
      await chmod(join(bin, name), 0o755);
    }
  }
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    HOME: home,
    FAKE_LOG_DIR: dir,
  };
  const session = (args, extraEnv = {}) =>
    execFileAsync("sh", [SCRIPT, ...args], { env: { ...env, ...extraEnv } });
  let runtimeDir;
  try {
    await run({ dir, home, session, track: (path) => (runtimeDir = path) });
  } finally {
    await rm(dir, { recursive: true, force: true });
    if (runtimeDir?.startsWith("/tmp/vibepod-runtime.")) {
      await rm(runtimeDir, { recursive: true, force: true });
    }
  }
}

function parseEnv(stdout) {
  return Object.fromEntries(
    stdout
      .trim()
      .split("\n")
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
}

test("keyring-session starts a private bus and an unlocked secrets keyring", async () => {
  await withSandbox(async ({ dir, home, session, track }) => {
    const { stdout, stderr } = await session(["sh", "-c", PRINT_ENV]);
    const seen = parseEnv(stdout);
    track(seen.runtime);

    assert.equal(stderr, "");
    assert.equal(seen.bus, "unix:path=/fake/bus,guid=1234");
    // Off the persisted mount, so launches do not pile up stale sockets there.
    assert.match(seen.runtime, /^\/tmp\/vibepod-runtime\.\w+$/);

    const dbusArgs = (await readFile(join(dir, "dbus.args"), "utf8")).trim();
    assert.equal(
      dbusArgs,
      `--session --fork --print-address=1 --address=unix:path=${seen.runtime}/bus`,
    );

    const keyringArgs = await readFile(join(dir, "keyring.args"), "utf8");
    assert.equal(keyringArgs.trim(), "--unlock --components=secrets");
    // The keyring daemon must be pointed at the bus that was just started.
    assert.equal(
      (await readFile(join(dir, "keyring.bus"), "utf8")).trim(),
      "unix:path=/fake/bus,guid=1234",
    );
    // A password on stdin keeps --unlock from waiting on the terminal.
    assert.match(await readFile(join(dir, "keyring.stdin"), "utf8"), /\\n/);

    // The keyring files belong on the persisted mount.
    const keyrings = await stat(join(home, ".local/share/keyrings"));
    assert.ok(keyrings.isDirectory());
  });
});

test("keyring-session forwards the command argv untouched", async () => {
  await withSandbox(async ({ session, track }) => {
    const { stdout } = await session([
      "sh",
      "-c",
      'echo "runtime=$XDG_RUNTIME_DIR"; printf "[%s]\\n" "$@"',
      "sh",
      "fix the tests",
      "--resume",
      "it's",
    ]);
    const [runtime, ...argv] = stdout.trim().split("\n");
    track(runtime.replace("runtime=", ""));
    assert.deepEqual(argv, ["[fix the tests]", "[--resume]", "[it's]"]);
  });
});

test("keyring-session propagates the command exit status", async () => {
  await withSandbox(async ({ session }) => {
    await assert.rejects(
      session(["sh", "-c", "exit 7"], { VP_WARP_KEYRING: "0" }),
      (error) => error.code === 7,
    );
  });
});

test("keyring-session warns and still runs the command without the daemons", async () => {
  await withSandbox(
    async ({ session }) => {
      const { stdout, stderr } = await session(["sh", "-c", PRINT_ENV]);
      assert.equal(parseEnv(stdout).bus, "");
      assert.match(
        stderr,
        /vibepod: warning: could not start the container keyring/,
      );
      assert.match(stderr, /WARP_API_KEY/);
    },
    { daemons: false },
  );
});

test("keyring-session warns when the keyring daemon fails to unlock", async () => {
  await withSandbox(async ({ session, track }) => {
    const { stdout, stderr } = await session(["sh", "-c", PRINT_ENV], {
      FAKE_KEYRING_EXIT: "1",
    });
    track(parseEnv(stdout).runtime);
    assert.match(stderr, /could not start the container keyring/);
  });
});

test("keyring-session leaves an existing session bus alone", async () => {
  await withSandbox(async ({ dir, session }) => {
    const { stdout, stderr } = await session(["sh", "-c", PRINT_ENV], {
      DBUS_SESSION_BUS_ADDRESS: "unix:path=/host/bus",
    });
    assert.equal(stderr, "");
    assert.equal(parseEnv(stdout).bus, "unix:path=/host/bus");
    await assert.rejects(readFile(join(dir, "dbus.args")), { code: "ENOENT" });
  });
});

test("keyring-session can be switched off with VP_WARP_KEYRING=0", async () => {
  await withSandbox(async ({ dir, session }) => {
    const { stdout, stderr } = await session(["sh", "-c", PRINT_ENV], {
      VP_WARP_KEYRING: "0",
    });
    assert.equal(stderr, "");
    assert.equal(parseEnv(stdout).bus, "");
    await assert.rejects(readFile(join(dir, "dbus.args")), { code: "ENOENT" });
  });
});
