import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createTerminalLogger } from "./terminal-logger.mjs";

test("parser diagnostic floods only retain counters", () => {
  let events = 0;
  const logger = createTerminalLogger(() => events++, () => 0, {
    error() { throw new Error("Parser data reached console"); }, warn() {}
  });
  const state = { get data() { throw new Error("Parser state inspected"); } };
  for (let i = 0; i < 100000; i++) logger.error("Parsing error: ", state);
  assert.equal(logger.counts.parserErrors, 100000);
  assert.equal(events, 100000);
});

test("other diagnostics are bounded and never forward attached objects", () => {
  let time = 0;
  const messages = [];
  const logger = createTerminalLogger(() => {}, () => time, {
    error: (...args) => messages.push(args), warn: (...args) => messages.push(args)
  });
  for (let i = 0; i < 1000; i++) logger.error("Example error", { private: "data" });
  assert.deepEqual(messages, [["[xterm] Example error"]]);
  assert.equal(logger.counts.otherErrors, 1000);
  time = 5000;
  logger.error("Another error");
  assert.equal(messages.length, 2);
});

test("installed xterm routes malformed-byte errors through the counter logger", async () => {
  const { Terminal } = createRequire(import.meta.url)("@xterm/xterm");
  const logger = createTerminalLogger(() => {}, () => 0, {
    error() { throw new Error("Unexpected console output"); }, warn() {}
  });
  const terminal = new Terminal({ cols: 97, rows: 33, logger, logLevel: "warn" });
  try {
    await new Promise(resolve => terminal.write(new Uint8Array(8192).fill(127), resolve));
    assert.equal(logger.counts.parserErrors, 8192);
  } finally { terminal.dispose(); }
});
