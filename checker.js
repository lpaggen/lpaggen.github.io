import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";
import initChecker, { analyze_ir } from "./checker/pkg/pdc_rust_check.js";

const button = document.querySelector("#analyze-python");
const status = document.querySelector("#checker-status");
const results = document.querySelector("#checker-results");

// Concrete constraints are handled inside the checker. The hook is already in
// place for the Z3/WASM SMT bridge used by symbolic constraints.
globalThis.pdcSolveSmt2 = () => "unknown";

let buildIr;

async function initializeChecker() {
  await initChecker();

  status.textContent = "Loading Python frontend…";
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("protobuf==7.35.1")
  `);

  // Version the generated archive URL so GitHub Pages and the browser cannot
  // reuse a stale Python frontend after a deployment.
  const response = await fetch("./checker/frontend.zip?v=d56363b");
  if (!response.ok) {
    throw new Error(`frontend download failed (${response.status})`);
  }
  pyodide.unpackArchive(await response.arrayBuffer(), "zip");
  buildIr = pyodide.pyimport("browser_api").build_ir;

  button.textContent = "Analyze";
  button.disabled = false;
  status.textContent = "Ready — runs locally in your browser.";
}

function editorSource() {
  return window.pythonEditor
    ? window.pythonEditor.getValue()
    : document.querySelector("#python-code").value;
}

function renderDiagnostics(diagnostics) {
  results.replaceChildren();

  if (diagnostics.length === 0) {
    const success = document.createElement("p");
    success.className = "checker-success";
    success.textContent = "No issues found.";
    results.append(success);
    return;
  }

  for (const diagnostic of diagnostics) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "checker-diagnostic";

    const span = diagnostic.span;
    const location = span
      ? `Line ${span.lineno}, column ${span.col_offset + 1}`
      : "Unknown location";
    const locationLabel = document.createElement("strong");
    locationLabel.textContent = location;
    const message = document.createElement("span");
    message.textContent = diagnostic.message;
    item.append(locationLabel, message);

    if (span && window.pythonEditor) {
      item.addEventListener("click", () => {
        const start = { line: span.lineno - 1, ch: span.col_offset };
        const end = {
          line: (span.end_lineno ?? span.lineno) - 1,
          ch: span.end_col_offset ?? span.col_offset,
        };
        window.pythonEditor.focus();
        window.pythonEditor.setSelection(start, end);
      });
    }

    results.append(item);
  }
}

button.addEventListener("click", () => {
  button.disabled = true;
  status.textContent = "Analyzing…";

  try {
    const pythonBytes = buildIr(editorSource(), "playground.py");
    const bytes = pythonBytes.toJs ? pythonBytes.toJs() : pythonBytes;
    const output = JSON.parse(analyze_ir(bytes));
    pythonBytes.destroy?.();

    if (output.error) throw new Error(output.error);
    renderDiagnostics(output);
    status.textContent = `Finished with ${output.length} diagnostic${output.length === 1 ? "" : "s"}.`;
  } catch (error) {
    results.textContent = String(error);
    status.textContent = "Analysis failed.";
  } finally {
    button.disabled = false;
  }
});

initializeChecker().catch((error) => {
  button.textContent = "Checker unavailable";
  status.textContent = String(error);
  console.error(error);
});
