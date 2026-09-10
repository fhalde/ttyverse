// Random/binary output can generate thousands of parser diagnostics per second.
// Keep counts, never send parser-state objects into the webview console.
export function createTerminalLogger(onDiagnostic = () => {}, now = () => performance.now(), sink = console) {
  const counts = { parserErrors: 0, otherErrors: 0, warnings: 0 };
  const lastLog = { error: -Infinity, warn: -Infinity };
  function report(level, message) {
    if (level === "error" && message === "Parsing error: ") {
      counts.parserErrors++;
      onDiagnostic("parserErrors");
      return;
    }
    const kind = level === "error" ? "otherErrors" : "warnings";
    counts[kind]++;
    onDiagnostic(kind);
    const time = now();
    if (time - lastLog[level] < 5000) return;
    lastLog[level] = time;
    // Do not retain optional parameters (buffers, parser states, or terminals).
    sink[level](`[xterm] ${typeof message === "string" ? message.slice(0, 240) : level}`);
  }
  return {
    counts,
    trace() {}, debug() {}, info() {},
    warn(message) { report("warn", message); },
    error(message) { report("error", message); }
  };
}
