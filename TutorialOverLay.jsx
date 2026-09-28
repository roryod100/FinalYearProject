import React, { useEffect, useState, useRef } from "react";
import "../styles/main.css";

// Each object here represents one step in the guided tutorial.
// targetId links the step to an element in the interface.
const TUTORIAL_STEPS = [
  {
    title: "Welcome to DeductIT",
    text: "This short tutorial will guide you through the interface.",
    targetId: null,
  },
  {
    title: "Your Score",
    text: "Your score increases when you complete proofs correctly.",
    targetId: "score-highlight",
  },
  {
    title: "Ingredients",
    text: "Click symbols here to build logical formulas.",
    targetId: "ingredient-row",
  },
  {
    title: "Workspace",
    text: "Your current formula appears here.",
    targetId: "workspace-display",
  },
  {
    title: "Spellbook",
    text: "Each added line of your proof appears here.",
    targetId: "spellbook-highlight",
  },
  {
    title: "Brew Potion",
    text: "When you're done, brew the potion to check your proof.",
    targetId: "brew-highlight",
  },
];

function TutorialOverlay({ open, onClose }) {
  // Tracks which tutorial step the user is currently on.
  const [step, setStep] = useState(0);

  // This is used just to force a re-render when the window scrolls or resizes.
  // That helps keep the tutorial highlight and card in the correct position.
  const [, forceUpdate] = useState(0);

  // Ref for the tutorial card itself.
  const cardRef = useRef(null);

  // Ref to the currently highlighted element so the highlight class can be cleaned up properly.
  const activeElRef = useRef(null);

  // Current tutorial step object.
  const current = TUTORIAL_STEPS[step];

  // Gets the id of the current target element if there is one.
  const currentTargetId = current?.targetId ?? null;

  // Whenever the tutorial is opened, start again from the first step.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Recalculate positions whenever the user scrolls or resizes the page.
  // This keeps the spotlight and info card aligned with the target element.
  useEffect(() => {
    if (!open) return;

    const handleUpdate = () => {
      forceUpdate((v) => v + 1);
    };

    window.addEventListener("scroll", handleUpdate, { passive: true });
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [open]);

  // Adds a glow/highlight class to the active target element.
  // Also makes sure any old highlight is removed first.
  useEffect(() => {
    if (activeElRef.current) {
      activeElRef.current.classList.remove("tutorial-active");
      activeElRef.current = null;
    }

    if (!open) return;
    if (!currentTargetId) return;

    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(currentTargetId);
      if (el) {
        el.classList.add("tutorial-active");
        activeElRef.current = el;
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [open, currentTargetId]);

  // If the tutorial is closed, do not render anything.
  if (!open) return null;

  // Finds the current target element on screen and returns its size/position.
  const getTargetRect = () => {
    if (!currentTargetId) return null;
    const el = document.getElementById(currentTargetId);
    if (!el) return null;
    return el.getBoundingClientRect();
  };

  // Creates the visible spotlight box around the active target.
  // Padding is adjusted slightly depending on the target so the box looks cleaner.
  const getHighlightStyle = () => {
    const rect = getTargetRect();
    if (!rect) return null;

    let padX = 12;
    let padY = 12;

    if (currentTargetId === "workspace-display") {
      padX = 18;
      padY = 14;
    }
    if (currentTargetId === "ingredient-row") {
      padX = 14;
      padY = 12;
    }
    if (currentTargetId === "score-highlight") {
      padX = 12;
      padY = 12;
    }
    if (currentTargetId === "spellbook-highlight") {
      padX = 14;
      padY = 14;
    }
    if (currentTargetId === "brew-highlight") {
      padX = 16;
      padY = 16;
    }

    return {
      position: "fixed",
      top: rect.top - padY,
      left: rect.left - padX,
      width: rect.width + padX * 2,
      height: rect.height + padY * 2,
    };
  };

  // Positions the tutorial card near the highlighted element.
  // If there is no target, the card just appears in the bottom-right.
  const getCardStyle = () => {
    const rect = getTargetRect();

    if (!rect) {
      return {
        position: "fixed",
        bottom: 40,
        right: 40,
        width: 320,
      };
    }

    const gap = 20;
    const cardHeight = cardRef.current?.offsetHeight || 260;
    const cardWidth = 320;

    let top;
    let left = rect.left;

    // For the brew button, force the card above it so it does not cover the button.
    if (currentTargetId === "brew-highlight") {
      top = rect.top - cardHeight - gap;
    } else {
      top = rect.bottom + gap;

      // If there is not enough room below the target, place the card above instead.
      if (top + cardHeight > window.innerHeight) {
        top = rect.top - cardHeight - gap;
      }
    }

    // Keep the card inside the screen horizontally.
    if (left + cardWidth > window.innerWidth) {
      left = window.innerWidth - cardWidth - gap;
    }
    if (left < gap) left = gap;

    // Safety check so it never goes off the top of the screen.
    if (top < gap) top = gap;

    return {
      position: "fixed",
      top,
      left,
      width: cardWidth,
    };
  };

  // Called when the user completes the tutorial.
  // It saves a flag in localStorage so the tutorial does not automatically open again.
  const finishTutorial = () => {
    localStorage.setItem("deductit_tutorial_seen", "true");
    onClose();
  };

  // CSS custom properties used to create the spotlight "hole" effect in the overlay.
  const highlightStyle = getHighlightStyle();
  const overlayVars = highlightStyle
    ? {
        "--hx": `${highlightStyle.left}px`,
        "--hy": `${highlightStyle.top}px`,
        "--hw": `${highlightStyle.width}px`,
        "--hh": `${highlightStyle.height}px`,
      }
    : {};

  return (
    <div className="tutorial-overlay" style={overlayVars}>
      {/* Spotlight box around the current target element */}
      {highlightStyle && (
        <div className="tutorial-highlight" style={highlightStyle} />
      )}

      {/* Main tutorial info card */}
      <div
        ref={cardRef}
        className="tutorial-modal interactive"
        style={getCardStyle()}
      >
        <div className="tutorial-arrow" />
        <h2>{current.title}</h2>
        <p>{current.text}</p>

        {/* Navigation buttons for moving through the tutorial */}
        <div className="tutorial-actions">
          <button
            className="secondary-btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </button>

          {step < TUTORIAL_STEPS.length - 1 ? (
            <button
              className="primary-btn"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button className="primary-btn" onClick={finishTutorial}>
              Start Playing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialOverlay;