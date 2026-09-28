// backend/routes/checkProof.js
import express from "express";

const router = express.Router();

/*
  Extracts just the conclusion part of the goal.

  Examples:
  "7. ⊢ (P∧Q)→P (7)"  -> "(P∧Q)→P"
  ". ⊢ Q (3)"         -> "Q"
  "P→P"               -> "P→P"
*/
function extractConclusion(goalText) {
  if (!goalText) return "";

  const parts = goalText.split("⊢");
  if (parts.length < 2) {
    return goalText.trim();
  }

  let rhs = parts[1].trim();

  // Removes the step count at the end if present, e.g. "(7)"
  rhs = rhs.replace(/\(\d+\)\s*$/, "").trim();
  return rhs;
}

/*
  Makes sure all proof lines have a consistent object structure.

  This is useful because some lines may come in as plain strings,
  while others come in as full objects from the frontend.
*/
function normaliseLines(lines) {
  return lines.map((l) => {
    if (typeof l === "string") {
      return {
        formula: l.trim(),
        rule: "Unknown",
        from: [],
        indent: 0,
        isAssumption: false,
      };
    }

    const formula = (l.formula || "").trim();
    const rule = (l.rule || "Unknown").trim();

    // Only keep valid positive integer references
    const from = Array.isArray(l.from)
      ? l.from.filter((n) => Number.isInteger(n) && n > 0)
      : [];

    const indent = Number.isInteger(l.indent) && l.indent >= 0 ? l.indent : 0;
    const isAssumption = !!l.isAssumption || rule === "Assumption";

    return { formula, rule, from, indent, isAssumption };
  });
}

/*
  A simple parser that turns a logical formula into a small AST
  (abstract syntax tree).

  This is not a full theorem prover, but it is enough to compare
  the structure of formulas and check core natural deduction rules.
*/
function parseFormula(expr) {
  const s = expr.replace(/\s+/g, "");

  // Removes one layer of outer brackets if they wrap the whole formula
  const stripParens = (str) => {
    if (!str.startsWith("(") || !str.endsWith(")")) return str;

    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;

      // If depth reaches 0 too early, then the outer brackets
      // do not surround the full expression
      if (depth === 0 && i < str.length - 1) {
        return str;
      }
    }

    return str.slice(1, -1);
  };

  const parse = (str) => {
    str = stripParens(str);

    if (str === "") throw new Error("Empty formula");

    // Negation
    if (str[0] === "¬") {
      return { kind: "not", sub: parse(str.slice(1)) };
    }

    // Quantifiers
    if (str[0] === "∀" || str[0] === "∃") {
      const quant = str[0];
      const v = str[1];
      const body = str.slice(2);

      return {
        kind: quant === "∀" ? "forall" : "exists",
        variable: v,
        body: parse(body),
      };
    }

    // Finds the main connective at depth 0 only
    const findMainOp = (str, ops) => {
      let depth = 0;
      let pos = -1;

      for (let i = 0; i < str.length; i++) {
        const c = str[i];

        if (c === "(") depth++;
        else if (c === ")") depth--;

        if (depth !== 0) continue;

        if (ops.includes(c)) {
          pos = i;
        }
      }

      return pos;
    };

    // Lowest precedence first
    let idx = findMainOp(str, ["↔"]);
    if (idx !== -1) {
      return {
        kind: "iff",
        left: parse(str.slice(0, idx)),
        right: parse(str.slice(idx + 1)),
      };
    }

    idx = findMainOp(str, ["→"]);
    if (idx !== -1) {
      return {
        kind: "imp",
        left: parse(str.slice(0, idx)),
        right: parse(str.slice(idx + 1)),
      };
    }

    idx = findMainOp(str, ["∨"]);
    if (idx !== -1) {
      return {
        kind: "or",
        left: parse(str.slice(0, idx)),
        right: parse(str.slice(idx + 1)),
      };
    }

    idx = findMainOp(str, ["∧"]);
    if (idx !== -1) {
      return {
        kind: "and",
        left: parse(str.slice(0, idx)),
        right: parse(str.slice(idx + 1)),
      };
    }

    // If no connective is found, treat it as an atomic formula
    return { kind: "atom", name: str };
  };

  return parse(s);
}

/*
  Compares two ASTs to see if they represent the same formula structure.
*/
function astEqual(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "atom":
      return a.name === b.name;

    case "not":
      return astEqual(a.sub, b.sub);

    case "and":
    case "or":
    case "imp":
    case "iff":
      return astEqual(a.left, b.left) && astEqual(a.right, b.right);

    case "forall":
    case "exists":
      return a.variable === b.variable && astEqual(a.body, b.body);

    default:
      return false;
  }
}

/*
  Checks whether one specific line is valid according to its rule.

  Returns:
    { ok: true }
  or
    { ok: false, message: "..." }
*/
function checkLineRule(lineIndex, lines, asts) {
  const line = lines[lineIndex];
  const thisAst = asts[lineIndex];
  const n = lines.length;

  // Line references are stored 1-based on the frontend, so convert carefully
  const getAst = (k) => asts[k - 1];
  const getFormula = (k) => lines[k - 1]?.formula || "";

  const mkErr = (msg) => ({ ok: false, message: `Line ${lineIndex + 1}: ${msg}` });

  // Very basic checks first
  if (!line.formula) return mkErr("empty formula.");
  if (!line.rule) return mkErr("missing rule.");

  // Check that referenced lines actually exist and are earlier in the proof
  for (const ref of line.from) {
    if (ref < 1 || ref > n) {
      return mkErr(`references invalid line ${ref}.`);
    }

    if (ref >= lineIndex + 1) {
      return mkErr(`cannot depend on future line ${ref}.`);
    }
  }

  switch (line.rule) {
    case "Premise":
    case "Assumption":
      return { ok: true };

    case "Reiteration": {
      if (line.from.length < 1) {
        return mkErr("Reiteration needs at least one reference.");
      }

      const match = line.from.some((k) => astEqual(thisAst, getAst(k)));
      if (!match) {
        return mkErr("Reiteration formula does not match any referenced line.");
      }

      return { ok: true };
    }

    case "∧ Intro": {
      if (line.from.length !== 2) {
        return mkErr("∧ Intro must cite exactly two lines.");
      }

      const a = getAst(line.from[0]);
      const b = getAst(line.from[1]);

      if (!a || !b) return mkErr("bad references for ∧ Intro.");

      if (
        thisAst.kind === "and" &&
        ((astEqual(thisAst.left, a) && astEqual(thisAst.right, b)) ||
          (astEqual(thisAst.left, b) && astEqual(thisAst.right, a)))
      ) {
        return { ok: true };
      }

      return mkErr("∧ Intro: conclusion must be a conjunction of referenced lines.");
    }

    case "∧ Elim L": {
      if (line.from.length !== 1) {
        return mkErr("∧ Elim L must cite exactly one line.");
      }

      const prem = getAst(line.from[0]);
      if (!prem || prem.kind !== "and") {
        return mkErr("∧ Elim L: referenced line is not a conjunction.");
      }

      if (!astEqual(thisAst, prem.left)) {
        return mkErr("∧ Elim L: conclusion must match left conjunct.");
      }

      return { ok: true };
    }

    case "∧ Elim R": {
      if (line.from.length !== 1) {
        return mkErr("∧ Elim R must cite exactly one line.");
      }

      const prem = getAst(line.from[0]);
      if (!prem || prem.kind !== "and") {
        return mkErr("∧ Elim R: referenced line is not a conjunction.");
      }

      if (!astEqual(thisAst, prem.right)) {
        return mkErr("∧ Elim R: conclusion must match right conjunct.");
      }

      return { ok: true };
    }

    case "∨ Intro L": {
      if (line.from.length !== 1) {
        return mkErr("∨ Intro L must cite exactly one line.");
      }

      const a = getAst(line.from[0]);
      if (!a) return mkErr("bad reference for ∨ Intro L.");

      if (thisAst.kind === "or" && astEqual(thisAst.left, a)) {
        return { ok: true };
      }

      return mkErr("∨ Intro L: conclusion must be A∨B with A the referenced line.");
    }

    case "∨ Intro R": {
      if (line.from.length !== 1) {
        return mkErr("∨ Intro R must cite exactly one line.");
      }

      const a = getAst(line.from[0]);
      if (!a) return mkErr("bad reference for ∨ Intro R.");

      if (thisAst.kind === "or" && astEqual(thisAst.right, a)) {
        return { ok: true };
      }

      return mkErr("∨ Intro R: conclusion must be B∨A with A the referenced line.");
    }

    case "→ Elim": {
      if (line.from.length !== 2) {
        return mkErr("→ Elim must cite exactly two lines.");
      }

      const a1 = getAst(line.from[0]);
      const a2 = getAst(line.from[1]);

      if (!a1 || !a2) return mkErr("bad references for → Elim.");

      // Case 1: A, A→B
      if (a2.kind === "imp" && astEqual(a1, a2.left) && astEqual(thisAst, a2.right)) {
        return { ok: true };
      }

      // Case 2: A→B, A
      if (a1.kind === "imp" && astEqual(a2, a1.left) && astEqual(thisAst, a1.right)) {
        return { ok: true };
      }

      return mkErr("→ Elim: conclusion must be B from A and A→B.");
    }

    /*
      These rules are not fully implemented yet.
      For now they are accepted so the system still works
      while the checker is being developed further.
    */
    case "∨ Elim":
    case "→ Intro":
    case "¬ Intro":
    case "¬ Elim":
    case "↔ Intro":
    case "↔ Elim L":
    case "↔ Elim R":
    case "∀ Intro":
    case "∀ Elim":
    case "∃ Intro":
    case "∃ Elim":
    case "= Intro":
    case "= Elim":
      return { ok: true };

    default:
      // Unknown rules are currently allowed rather than rejected
      return { ok: true };
  }
}

/*
  Checks the proof as a whole:
  1. Makes sure lines exist
  2. Parses every formula
  3. Checks each line rule
  4. Verifies that the final line matches the goal
*/
function ndCheck(lines, goalFormula) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { valid: false, error: "No lines submitted." };
  }

  const n = lines.length;

  // Parse each proof line into AST form
  const asts = [];
  try {
    for (let i = 0; i < n; i++) {
      if (!lines[i].formula) {
        return {
          valid: false,
          error: `Line ${i + 1} has an empty formula.`,
        };
      }

      asts[i] = parseFormula(lines[i].formula);
    }
  } catch (e) {
    return { valid: false, error: "Failed to parse one of the formulas." };
  }

  // Check each line one by one
  for (let i = 0; i < n; i++) {
    const res = checkLineRule(i, lines, asts);
    if (!res.ok) {
      return { valid: false, error: res.message };
    }
  }

  // Final line must match the target goal
  const lastAst = asts[n - 1];
  let goalAst;

  try {
    goalAst = parseFormula(goalFormula);
  } catch (e) {
    return { valid: false, error: "Goal formula is not well-formed." };
  }

  if (!astEqual(lastAst, goalAst)) {
    return {
      valid: false,
      error: "Final line does not match the goal formula.",
    };
  }

  return { valid: true };
}

/*
  POST /api/check-proof

  Expects:
    {
      lines: Array<string | { formula, rule, from }>,
      goal: string,
      levelId?: any
    }

  Returns:
    {
      valid: true/false,
      error?: string
    }
*/
router.post("/", async (req, res) => {
  try {
    const { lines, goal } = req.body;
    console.log("🚀 Incoming payload:", req.body);

    // Basic payload validation
    if (!Array.isArray(lines) || typeof goal !== "string") {
      return res.status(400).json({
        valid: false,
        error: "Invalid payload format.",
      });
    }

    const goalFormula = extractConclusion(goal);
    console.log("🎯 Extracted goal formula:", goalFormula);

    if (!goalFormula) {
      return res.json({ valid: false, error: "Empty goal formula." });
    }

    const normLines = normaliseLines(lines);
    const result = ndCheck(normLines, goalFormula);

    return res.json(result);
  } catch (err) {
    console.error("❌ Backend /api/check-proof error:", err);
    return res.status(500).json({
      valid: false,
      error: "Internal server error.",
    });
  }
});

export default router;