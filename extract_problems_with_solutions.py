import json
from PyPDF2 import PdfReader

input_file = "Natural Deduction Pack.pdf"
output_file = "natural_deduction_levels.json"

reader = PdfReader(input_file)
text = ""

# ⬇️ Skip the first 10 pages — start reading from page 10 onward
for i, page in enumerate(reader.pages):
    if i < 10:
        continue
    page_text = page.extract_text()
    if page_text:
        text += page_text + "\n"

lines = [line.strip() for line in text.split("\n") if line.strip()]

problems_text = []
solutions_text = []
collecting_solutions = False

# Separate problems from solutions
for line in lines:
    if "5 Solutions" in line or "(Solutions" in line:
        collecting_solutions = True
        continue
    if not collecting_solutions:
        problems_text.append(line)
    else:
        solutions_text.append(line)

# --- Extract problems ---
problems = []
topic = ""
id_counter = 1

for line in problems_text:
    # Detect topic headers
    if any(keyword in line for keyword in [
        "Core", "Conjunction", "Implication", "Disjunction",
        "Biconditional", "Negation", "Universal", "Existential", "Identity"
    ]):
        topic = line
        continue

    # Detect numbered problems (like 1. (3))
    if (
        (any(char.isdigit() for char in line[:3]) and "(" in line and ")" in line)
        or line.lower().startswith("problem")
    ):
        problems.append({
            "id": f"ND{id_counter:03}",
            "topic": topic or "General",
            "goal": line,
            "solution": ""
        })
        id_counter += 1

# --- Extract solutions ---
solution_index = 0
current_solution = []

for line in solutions_text:
    if (
        line.lower().startswith("problem")
        or (any(char.isdigit() for char in line[:3]) and "(" in line and ")" in line)
    ):
        if current_solution and solution_index < len(problems):
            problems[solution_index]["solution"] = "\n".join(current_solution).strip()
            current_solution = []
            solution_index += 1
    else:
        current_solution.append(line)

# Attach last solution if present
if current_solution and solution_index < len(problems):
    problems[solution_index]["solution"] = "\n".join(current_solution).strip()

# Write to JSON
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(problems, f, indent=2, ensure_ascii=False)

print(f"✅ Extracted {len(problems)} problems (with possible solutions) to {output_file}")
