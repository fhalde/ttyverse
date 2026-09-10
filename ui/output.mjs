// Backend limits outstanding output to 32 KiB per terminal. Consume it in small
// batches, yielding between them so continuous output cannot monopolize frames.
export function createOutputQueue(write, acknowledge, onError, schedule = callback => setTimeout(callback, 16)) {
  const chunks = [];
  let running = false;
  function pump() {
    const batch = [];
    let bytes = 0;
    while (chunks.length && bytes + chunks[0].length <= 8192) {
      const chunk = chunks.shift();
      batch.push(chunk);
      bytes += chunk.length;
    }
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of batch) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      write(data, () => {
        Promise.resolve().then(() => acknowledge(bytes)).then(() => {
          if (chunks.length) schedule(pump);
          else running = false;
        }).catch(onError);
      });
    } catch (error) { onError(error); }
  }
  return data => {
    // Split defensively so every chunk can fit in a batch.
    for (let offset = 0; offset < data.length; offset += 4096) {
      chunks.push(data.subarray(offset, offset + 4096));
    }
    if (!running && chunks.length) {
      running = true;
      schedule(pump);
    }
  };
}
