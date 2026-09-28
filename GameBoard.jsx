import React, { useState, useEffect } from "react";
import TutorialOverLay from "./TutorialOverLay";
import "../styles/main.css";

function GameBoard() {
  // This controls whether the user is playing propositional or predicate logic mode.
  const [mode, setMode] = useState("propositional");

  // Tutorial popup state.
  // It opens the first time the page is loaded unless the user has already seen it.
  const [showTutorial, setShowTutorial] = useState(false);

  // Main game state.
  const [problems, setProblems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [brewAnimation, setBrewAnimation] = useState("");

  // Formula currently being built in the workspace.
  const [currentExpression, setCurrentExpression] = useState("");

  // Stores all proof lines the user has added.
  const [lines, setLines] = useState([]);

  // Feedback banner shown to the user after actions.
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");

  // Keeps track of how many correct proofs the user has completed.
  const [score, setScore] = useState(0);

  // Used while the backend is checking the proof.
  const [loading, setLoading] = useState(false);

  // Current rule selected by the user for the next line.
  const [currentRule, setCurrentRule] = useState("Premise");

  // Stores line references entered by the user, e.g. "1,2".
  const [currentFrom, setCurrentFrom] = useState("");

  // Tracks current subproof depth.
  const [indentLevel, setIndentLevel] = useState(0);

  // Load all levels from the JSON file when the component first mounts.
  useEffect(() => {
    fetch("/Natural_Deduction_levels.json")
      .then((res) => res.json())
      .then((data) => setProblems(data))
      .catch((err) => console.error("JSON Load Error:", err));
  }, []);

  // Show the tutorial the first time the app is opened.
  // This is checked using localStorage.
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("deductit_tutorial_seen");
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // If the problems have not loaded yet, show a loading message.
  if (problems.length === 0) {
    return <div className="loading">Brewing levels...</div>;
  }

  // Split the question bank depending on the selected mode.
  // Propositional mode uses the first 50 questions.
  // Predicate mode uses questions 51-60.
  const visibleProblems =
    mode === "predicate" ? problems.slice(50, 60) : problems.slice(0, 50);

  // Safety check in case the JSON file does not contain the expected data.
  if (visibleProblems.length === 0) {
    return (
      <div className="loading">
        No problems available for this mode. Check your JSON ranges.
      </div>
    );
  }

  // Prevents errors if the current index goes out of range.
  const safeIndex = currentIndex >= visibleProblems.length ? 0 : currentIndex;
  const problem = visibleProblems[safeIndex];

  // Extracts the goal formula from text like:
  // "1. P∧Q ⊢ P (1)"
  const extractConclusion = (goalText) => {
    if (!goalText) return "";
    const split = goalText.split("⊢");
    if (split.length < 2) return goalText.trim();

    let rhs = split[1].trim();
    rhs = rhs.replace(/\(\d+\)\s*$/, "").trim();
    return rhs;
  };

  // Extracts the suggested step count from the end of the question text.
  const extractSteps = (goalText) => {
    const match = goalText.match(/\((\d+)\)\s*$/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Extracts any premises written before the turnstile symbol.
  // For example:
  // "3. Pa, Qa ⊢ ∃xPx (2)"
  // becomes ["Pa", "Qa"]
  const extractPremises = (goalText) => {
    if (!goalText) return [];

    const split = goalText.split("⊢");
    if (split.length < 2) return [];

    let lhs = split[0].trim();

    // Remove the question number at the start.
    lhs = lhs.replace(/^\d+\.\s*/, "").trim();

    if (!lhs) return [];

    return lhs
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  };

  const goalFormula = extractConclusion(problem.goal);
  const stepCount = extractSteps(problem.goal);
  const premises = extractPremises(problem.goal);

  // Buttons the user can click to build formulas.
  const BASE_INGREDIENTS = [
    { label: "P", symbol: "P" },
    { label: "Q", symbol: "Q" },
    { label: "R", symbol: "R" },
    { label: "¬", symbol: "¬" },
    { label: "∨", symbol: "∨" },
    { label: "∧", symbol: "∧" },
    { label: "→", symbol: "→" },
    { label: "↔", symbol: "↔" },
    { label: "(", symbol: "(" },
    { label: ")", symbol: ")" },
  ];

  // Extra symbols available only in predicate mode.
  const PREDICATE_EXTRAS = [
    { label: "∀", symbol: "∀" },
    { label: "∃", symbol: "∃" },
    { label: "x", symbol: "x" },
    { label: "a", symbol: "a" }
  ];

  // Combine the symbol sets depending on the mode.
  const INGREDIENTS =
    mode === "predicate"
      ? [...PREDICATE_EXTRAS, ...BASE_INGREDIENTS]
      : BASE_INGREDIENTS;

  // Available natural deduction rules shown in the dropdown.
  const ND_RULES = [
    "Premise",
    "Assumption",
    "Reiteration",
    "∧ Intro",
    "∧ Elim L",
    "∧ Elim R",
    "∨ Intro L",
    "∨ Intro R",
    "∨ Elim",
    "→ Intro",
    "→ Elim",
    "¬ Intro",
    "¬ Elim",
    "↔ Intro",
    "↔ Elim L",
    "↔ Elim R",
  ];

  // Clears any feedback message currently on screen.
  const clearFeedback = () => {
    setFeedback("");
    setFeedbackType("");
  };

  // Adds a clicked symbol to the workspace expression.
  const handleIngredientClick = (symbol) => {
    setCurrentExpression((prev) => prev + symbol);
    clearFeedback();
  };

  // Clears the formula currently being built.
  const handleClearExpression = () => {
    setCurrentExpression("");
    clearFeedback();
  };

  // Basic parser for propositional logic syntax.
  // This checks whether the formula entered is structurally valid before sending anything to the backend.
  const isWellFormedProp = (expr) => {
    if (!expr || expr.trim() === "") return false;
    const s = expr.trim();

    // A single capital letter is treated as a valid atomic proposition.
    if (/^[A-Z]$/.test(s)) return true;

    try {
      const tokens = Array.from(s);
      let i = 0;

      const peek = () => tokens[i];
      const consume = (x) => (tokens[i] === x ? (i++, true) : false);

      const parseFormula = () => parseEquiv();

      const parseEquiv = () => {
        if (!parseImpl()) return false;
        while (peek() === "↔") {
          consume("↔");
          if (!parseImpl()) return false;
        }
        return true;
      };

      const parseImpl = () => {
        if (!parseOr()) return false;
        while (peek() === "→") {
          consume("→");
          if (!parseOr()) return false;
        }
        return true;
      };

      const parseOr = () => {
        if (!parseAnd()) return false;
        while (peek() === "∨") {
          consume("∨");
          if (!parseAnd()) return false;
        }
        return true;
      };

      const parseAnd = () => {
        if (!parseNot()) return false;
        while (peek() === "∧") {
          consume("∧");
          if (!parseNot()) return false;
        }
        return true;
      };

      const parseNot = () => {
        if (peek() === "¬") {
          consume("¬");
          return parseNot();
        }
        if (peek() === "(") {
          consume("(");
          if (!parseFormula()) return false;
          if (!consume(")")) return false;
          return true;
        }
        return parseAtom();
      };

      const parseAtom = () => {
        const letter = peek();
        if (!/[A-Z]/.test(letter)) return false;
        consume(letter);
        return true;
      };

      const ok = parseFormula();
      return ok && i === tokens.length;
    } catch {
      return false;
    }
  };

  // Predicate syntax check is more relaxed.
  // It mainly checks for very basic validity and balanced brackets.
  // The backend does the real validation here.
  const isWellFormedPredicate = (expr) => {
    if (!expr || expr.trim() === "") return false;

    try {
      const s = expr.trim();

      // Must contain at least one letter.
      if (!/[A-Za-z]/.test(s)) return false;

      // Check bracket balance.
      let depth = 0;
      for (const c of s) {
        if (c === "(") depth++;
        if (c === ")") depth--;
        if (depth < 0) return false;
      }
      if (depth !== 0) return false;

      return true;
    } catch {
      return false;
    }
  };

  // Adds a proof line to the spellbook.
  const handleAddLine = () => {
    if (!currentExpression.trim()) {
      setFeedback("⚠️ Add ingredients first.");
      setFeedbackType("error");
      return;
    }

    const expr = currentExpression.trim();

    const valid =
      mode === "predicate" ? isWellFormedPredicate(expr) : isWellFormedProp(expr);

    if (!valid) {
      setFeedback("❌ Invalid formula for this mode.");
      setFeedbackType("error");
      return;
    }

    // Convert the "from" input into an array of integers.
    const from = currentFrom
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "")
      .map((x) => parseInt(x, 10));

    const newLine = {
      formula: expr,
      rule: currentRule,
      from,
      indent: indentLevel,
      isAssumption: currentRule === "Assumption",
    };

    setLines((prev) => [...prev, newLine]);
    setCurrentExpression("");
    setCurrentFrom("");
    setCurrentRule("Premise");
    setFeedback("Added to spellbook.");
    setFeedbackType("info");
  };

  // Starts a new subproof by adding an assumption line
  // and increasing the indentation level.
  const handleStartSubproof = () => {
    const expr = currentExpression.trim();

    if (!expr) {
      setFeedback("⚠️ Write the assumption formula first.");
      setFeedbackType("error");
      return;
    }

    const valid =
      mode === "predicate" ? isWellFormedPredicate(expr) : isWellFormedProp(expr);

    if (!valid) {
      setFeedback("❌ Invalid assumption.");
      setFeedbackType("error");
      return;
    }

    const newIndent = indentLevel + 1;

    const newLine = {
      formula: expr,
      rule: "Assumption",
      from: [],
      indent: newIndent,
      isAssumption: true,
    };

    setLines((prev) => [...prev, newLine]);
    setIndentLevel(newIndent);
    setCurrentExpression("");
    setCurrentFrom("");
    setCurrentRule("Premise");
  };

  // Ends the current subproof by reducing indentation.
  const handleEndSubproof = () => {
    if (indentLevel === 0) {
      setFeedback("⚠️ No open subproof.");
      setFeedbackType("error");
      return;
    }
    setIndentLevel((lvl) => lvl - 1);
  };

  // Sends the proof to the backend for full validation.
  const handleCheckProof = async () => {
    if (lines.length === 0) {
      setFeedback("⚠️ Add lines before brewing!");
      setFeedbackType("error");
      return;
    }

    // Stops the user from simply typing the answer as a single line.
    if (lines.length === 1 && lines[0].formula === goalFormula) {
      setFeedback("⚠️ You must derive the result, not assert it.");
      setFeedbackType("error");
      return;
    }

    setLoading(true);
    setFeedback("Checking potion stability...");
    setFeedbackType("info");

    try {
      const res = await fetch("http://localhost:5000/api/check-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines,
          goal: goalFormula,
          levelId: problem.id,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.valid) {
        setFeedback("✨ Potion Complete! Your proof is correct.");
        setFeedbackType("success");
        setScore((s) => s + 1);

        // Play a short success animation on the cauldron.
        setBrewAnimation("brew-success");
        setTimeout(() => setBrewAnimation(""), 1200);
      } else {
        setFeedback(
          data.error
            ? `❌ Potion Failed. ${data.error}`
            : "❌ Potion Failed. Incorrect proof."
        );
        setFeedbackType("error");

        // Play a failure animation on the cauldron.
        setBrewAnimation("brew-fail");
        setTimeout(() => setBrewAnimation(""), 1200);
      }
    } catch (err) {
      setLoading(false);
      setFeedback("⚠️ Backend not running");
      setFeedbackType("error");
      console.error(err);
    }
  };

  // Moves to the next problem and resets the current workspace.
  const handleNextProblem = () => {
    if (visibleProblems.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % visibleProblems.length);
    setLines([]);
    setCurrentExpression("");
    setCurrentFrom("");
    setCurrentRule("Premise");
    setIndentLevel(0);
    setFeedback("");
  };

  return (
    <div className="game-container">
      <header className="header-bar">
        <h1 className="game-title">DeductIT</h1>

        {/* Top-right section for tutorial button and score */}
        <div className="header-right">
          <button className="help-btn" onClick={() => setShowTutorial(true)}>
            TUTORIAL
          </button>

          {/* Wrapper used as a clean highlight area for the tutorial */}
          <div id="score-highlight">
            <div className="score-panel" id="score-panel">
              Score: {score}
            </div>
          </div>
        </div>
      </header>

      {/* Lets the user switch between the two logic modes */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === "propositional" ? "active-mode" : ""}`}
          onClick={() => {
            setMode("propositional");
            setCurrentIndex(0);
            setLines([]);
            setCurrentExpression("");
            setCurrentFrom("");
            setCurrentRule("Premise");
            setIndentLevel(0);
            setFeedback("");
          }}
        >
          Propositional Mode
        </button>

        <button
          className={`mode-btn ${mode === "predicate" ? "active-mode" : ""}`}
          onClick={() => {
            setMode("predicate");
            setCurrentIndex(0);
            setLines([]);
            setCurrentExpression("");
            setCurrentFrom("");
            setCurrentRule("Premise");
            setIndentLevel(0);
            setFeedback("");
          }}
        >
          Predicate Mode
        </button>
      </div>

      {/* Displays the current question number, topic, premises and goal */}
      <section className="problem-section">
        <h2 className="question-number">
          Question {safeIndex + 1}
        </h2>

        <h2 className="topic-label">
          {mode === "predicate" ? "Predicate Logic" : "Propositional Logic"}
        </h2>

        <div className="premises-goal">
          {premises.length > 0 && (
            <div className="premises-block">
              <h3>Premises</h3>
              <ul>
                {premises.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="goal-block">
            <h3>Goal</h3>
            <p className="goal-text">
              {goalFormula}{" "}
              {stepCount && (
                <span className="step-count">({stepCount} steps)</span>
              )}
            </p>
          </div>
        </div>

        <button className="secondary-btn next-btn" onClick={handleNextProblem}>
          Next Problem →
        </button>
      </section>

      {/* Spellbook area showing all proof lines entered so far */}
      <aside className="spellbook-container">
        <div className="spellbook-content" id="spellbook-highlight">
          <h3>Spellbook</h3>
          {lines.length === 0 ? (
            <p>No spells yet.</p>
          ) : (
            <ul className="spellbook-list">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className="spellbook-line"
                  style={{
                    marginLeft: `${line.indent * 16}px`,
                    borderLeft:
                      line.indent > 0
                        ? "2px solid rgba(255,255,255,0.4)"
                        : "none",
                  }}
                >
                  <span className="line-number">{i + 1}.</span>
                  {line.isAssumption && (
                    <span className="assumption-tag">[assume]</span>
                  )}
                  <span className="line-formula">{line.formula}</span>
                  <span className="line-rule-tag">{line.rule}</span>
                  {line.from.length > 0 && (
                    <span className="line-from">from {line.from.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Symbol buttons used to build formulas */}
      <section className="ingredient-bar">
        <div className="ingredient-row" id="ingredient-row">
          {INGREDIENTS.map((ing, idx) => (
            <button
              key={idx}
              className="ingredient-btn"
              onClick={() => handleIngredientClick(ing.symbol)}
            >
              {ing.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main workspace for creating proof lines */}
      <section className="workspace-section">
        <h3>Workspace</h3>

        <div className="workspace-display" id="workspace-display">
          {currentExpression || (
            <span className="workspace-placeholder">
              Click ingredients to build a formula...
            </span>
          )}
        </div>

        {/* Input area for rule selection and line references */}
        <div className="line-meta-inputs">
          <div className="line-meta-field">
            <label>Rule:</label>
            <select
              className="rule-select"
              value={currentRule}
              onChange={(e) => setCurrentRule(e.target.value)}
            >
              {ND_RULES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="line-meta-field">
            <label>From:</label>
            <input
              className="from-input"
              placeholder="e.g. 1 or 1,2"
              value={currentFrom}
              onChange={(e) => setCurrentFrom(e.target.value)}
            />
          </div>
        </div>

        {/* Main workspace buttons */}
        <div className="workspace-controls">
          <button className="secondary-btn" onClick={handleClearExpression}>
            Clear
          </button>

          <button className="primary-btn" onClick={handleAddLine}>
            Add Line
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              if (lines.length === 0) return;
              const last = lines[lines.length - 1];
              setLines(lines.slice(0, -1));

              // If the last removed line was an assumption, reduce subproof depth.
              if (last.isAssumption) {
                setIndentLevel(Math.max(0, indentLevel - 1));
              }
            }}
          >
            Undo
          </button>
        </div>

        {/* Buttons for opening and closing subproofs */}
        <div className="subproof-controls">
          <button className="subproof-btn" onClick={handleStartSubproof}>
            ⬇️ Start Subproof
          </button>
          <button className="subproof-btn" onClick={handleEndSubproof}>
            ⬆️ End Subproof
          </button>
          <span className="indent-indicator">Depth: {indentLevel}</span>
        </div>

        {/* Brew button and animated cauldron */}
        <div className="brew-wrapper">
          <div className="brew-highlight-wrapper" id="brew-highlight">
            <div className="brew-controls">
              <button className="brew-btn" id="brew-btn" onClick={handleCheckProof}>
                Brew Potion
              </button>
            </div>
          </div>

          <div className="cauldron-wrapper">
            <img
              src="/cauldron.png"
              alt="cauldron"
              className={`cauldron-icon ${brewAnimation}`}
            />
          </div>
        </div>

        {/* Feedback shown after actions such as add line or check proof */}
        {feedback && (
          <div className={"feedback-banner " + (feedbackType || "info")}>
            {feedback}
          </div>
        )}

        {/* Loading message shown while waiting for backend validation */}
        {loading && <p className="loading">🧪 Checking with the Oracle...</p>}
      </section>

      {/* Tutorial modal */}
      <TutorialOverLay open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}

export default GameBoard;