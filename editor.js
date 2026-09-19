/* CodeMirror is bundled locally; the textarea remains usable if it cannot load. */
if (window.CodeMirror) {
  const editor = CodeMirror.fromTextArea(document.getElementById("python-code"), {
    mode: { name: "python", version: 3 },
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    inputStyle: "textarea",
    screenReaderLabel: "Python code",
    extraKeys: {
      Tab: function (cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection(" ".repeat(cm.getOption("indentUnit")), "end", "+input");
      },
      "Shift-Tab": function (cm) { cm.indentSelection("subtract"); },
      Esc: function (cm) {
        // Let the next Tab move focus, so keyboard users can exit the editor.
        cm.setOption("extraKeys", { ...cm.getOption("extraKeys"), Tab: false, "Shift-Tab": false });
      }
    }
  });
  const editingKeys = editor.getOption("extraKeys");
  editor.on("blur", function () { editor.setOption("extraKeys", editingKeys); });
  editor.getInputField().setAttribute("aria-describedby", "editor-help");
  window.pythonEditor = editor;
}
