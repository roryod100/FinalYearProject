from PyPDF2 import PdfReader

input_file = "Natural Deduction Pack.pdf"
reader = PdfReader(input_file)
text = ""
for page in reader.pages:
    page_text = page.extract_text()
    if page_text:
        text += page_text + "\n"

lines = [line.strip() for line in text.split("\n") if line.strip()]

found_core = False
counter = 0

for line in lines:
    if not found_core:
        if line.startswith("4.1 Core") or line.startswith("Core"):
            found_core = True
            print("\n--- FOUND '4.1 Core' ---\n")
        continue

    # Print the next ~200 lines after "Core"
    if counter < 200:
        print(line)
        counter += 1
    else:
        break
