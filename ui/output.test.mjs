import assert from "node:assert/strict";
import test from "node:test";
import { createOutputQueue } from "./output.mjs";

test("flood output stays ordered, yields in small batches and only acknowledges parsed bytes", async () => {
  const scheduled = [];
  const writes = [];
  const acknowledgements = [];
  let parsed;
  const enqueue = createOutputQueue((data, done) => {
    writes.push(data);
    parsed = done;
  }, bytes => acknowledgements.push(bytes), error => { throw error; }, callback => scheduled.push(callback));
  const data = Uint8Array.from({ length: 32768 }, (_, i) => i % 251);
  enqueue(data);
  assert.equal(scheduled.length, 1);
  for (let i = 0; i < 4; i++) {
    scheduled.shift()();
    assert.equal(writes[i].length, 8192);
    assert.equal(acknowledgements.length, i);
    assert.equal(scheduled.length, 0);
    parsed();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(Uint8Array.from(writes.flatMap(chunk => [...chunk])), data);
  assert.deepEqual(acknowledgements, [8192, 8192, 8192, 8192]);
  assert.equal(scheduled.length, 0);
  // A quiet terminal must resume on its next output, independently of visibility.
  enqueue(new Uint8Array([65]));
  assert.equal(scheduled.length, 1);
});

test("new output waits for the previous acknowledgement without losing bytes", async () => {
  const scheduled = [];
  const writes = [];
  let acknowledge;
  const enqueue = createOutputQueue((data, done) => {
    writes.push([...data]);
    done();
  }, () => new Promise(resolve => { acknowledge = resolve; }), error => { throw error; },
  callback => scheduled.push(callback));
  enqueue(new Uint8Array([1, 2]));
  scheduled.shift()();
  await new Promise(resolve => setImmediate(resolve));
  enqueue(new Uint8Array([3, 4]));
  assert.equal(scheduled.length, 0);
  acknowledge();
  await new Promise(resolve => setImmediate(resolve));
  scheduled.shift()();
  assert.deepEqual(writes, [[1, 2], [3, 4]]);
});
