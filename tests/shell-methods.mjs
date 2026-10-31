import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile real production methods in isolation, supplying GNOME objects at their boundary.
// This avoids importing Shell resources or reimplementing the logic under test.
export function methods(path, className, names, globals = {}) {
  const source = ts.createSourceFile(
    path,
    readFileSync(new URL("../" + path, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const cls = source.statements.find(
    (n) => ts.isClassDeclaration(n) && n.name?.text === className,
  );
  const selected = cls.members.filter(
    (n) => n.name && names.includes(n.name.getText(source)),
  );
  if (selected.length !== names.length)
    throw new Error(
      "Missing production method: " +
        names.filter(
          (name) => !selected.some((n) => n.name.getText(source) === name),
        ),
    );
  const code =
    "class Subject {\n" +
    selected.map((n) => n.getText(source)).join("\n") +
    "\n}";
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  return new Function(...Object.keys(globals), js + "\nreturn Subject;")(
    ...Object.values(globals),
  );
}
