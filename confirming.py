import json

with open("natural_deduction_levels.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# print sample problem with its solution
sample = data[0]
print("--- SAMPLE PROBLEM ---")
print(f"Topic: {sample['topic']}")
print(f"Goal: {sample['goal']}\n")
print("--- SOLUTION (first 40 lines) ---")
print("\n".join(sample["solution"].split("\n")[:40]))
