/** PROTOTYPE — oxc adapter. Scoring must not import this file. */

import { parseSync, Visitor } from "oxc-parser";

function offsetToLine(sourceText, offset) {
  let line = 1;
  const end = Math.min(offset, sourceText.length);
  for (let i = 0; i < end; i++) {
    if (sourceText.charCodeAt(i) === 10) line++;
  }
  return line;
}

function keyName(key) {
  if (!key) return "(anonymous)";
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  if (key.type === "Identifier") return key.name;
  return "(computed)";
}

function qualifiedMember(owner, node, kind) {
  const quals = [];
  if (node.static) quals.push("static");
  if (kind === "get") quals.push("get");
  if (kind === "set") quals.push("set");
  const tail = [...quals, keyName(node.key)].join(" ");
  return `${owner}.${tail}`;
}

function bindingName(id) {
  return id?.type === "Identifier" ? id.name : null;
}

function unitName(stack, fn) {
  const method = findLast(stack, (n) => n.type === "MethodDefinition");
  if (method) {
    const cls = findLast(stack, (n) => n.type === "ClassDeclaration" || n.type === "ClassExpression");
    const className = bindingName(cls?.id) ?? "(anonymous)";
    if (method.kind === "constructor") return `${className}.constructor`;
    return qualifiedMember(className, method, method.kind);
  }

  const field = findLast(stack, (n) => n.type === "PropertyDefinition");
  if (field) {
    const cls = findLast(stack, (n) => n.type === "ClassDeclaration" || n.type === "ClassExpression");
    const className = bindingName(cls?.id) ?? "(anonymous)";
    return qualifiedMember(className, field, "method");
  }

  const prop = findLast(stack, (n) => n.type === "Property");
  if (prop) {
    const decl = findLast(stack, (n) => n.type === "VariableDeclarator");
    const objName = bindingName(decl?.id) ?? "(anonymous)";
    return `${objName}.${keyName(prop.key)}`;
  }

  if (fn.id?.name) return fn.id.name;

  const decl = findLast(stack, (n) => n.type === "VariableDeclarator");
  if (decl) {
    const name = bindingName(decl.id);
    if (name) return name;
  }

  if (findLast(stack, (n) => n.type === "ExportDefaultDeclaration")) return "default";
  return "(anonymous)";
}

function findLast(stack, pred) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (pred(stack[i])) return stack[i];
  }
  return null;
}

function hasBody(node) {
  return node.body != null;
}

function isFunctionLike(node) {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

export const oxcParser = {
  scoringUnits(filename, sourceText) {
    const result = parseSync(filename, sourceText);
    const fatal = result.errors.filter((e) => e.severity === "Error");
    if (fatal.length > 0) {
      throw new Error(fatal.map((e) => e.message).join("\n"));
    }

    const units = [];
    const stack = [];
    let depth = 0;
    let current = null;

    const enterFn = (node) => {
      stack.push(node);
      if (depth === 0 && hasBody(node)) {
        current = {
          name: unitName(stack, node),
          file: filename,
          startLine: offsetToLine(sourceText, node.start),
          endLine: offsetToLine(sourceText, Math.max(node.start, node.end - 1)),
          complexity: 1,
        };
        units.push(current);
      }
      depth++;
    };

    const exitFn = () => {
      depth--;
      stack.pop();
      if (depth === 0) current = null;
    };

    const bump = () => {
      if (depth >= 1 && current) current.complexity++;
    };

    const push = (node) => stack.push(node);
    const pop = () => stack.pop();

    const visitor = new Visitor({
      FunctionDeclaration: enterFn,
      "FunctionDeclaration:exit": exitFn,
      FunctionExpression: enterFn,
      "FunctionExpression:exit": exitFn,
      ArrowFunctionExpression: enterFn,
      "ArrowFunctionExpression:exit": exitFn,

      MethodDefinition: push,
      "MethodDefinition:exit": pop,
      PropertyDefinition: push,
      "PropertyDefinition:exit": pop,
      Property: push,
      "Property:exit": pop,
      VariableDeclarator: push,
      "VariableDeclarator:exit": pop,
      ClassDeclaration: push,
      "ClassDeclaration:exit": pop,
      ClassExpression: push,
      "ClassExpression:exit": pop,
      ExportDefaultDeclaration: push,
      "ExportDefaultDeclaration:exit": pop,

      IfStatement: bump,
      ForStatement: bump,
      ForInStatement: bump,
      ForOfStatement: bump,
      WhileStatement: bump,
      DoWhileStatement: bump,
      SwitchCase: bump,
      CatchClause: bump,
      ConditionalExpression: bump,
      LogicalExpression(node) {
        if (node.operator === "&&" || node.operator === "||") bump();
      },
    });

    visitor.visit(result.program);
    return units;
  },
};
