import fitz
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

doc = fitz.open("공정관리 강의자료 260317_1.pdf")
print(f"총 {len(doc)}페이지")
for i, page in enumerate(doc):
    text = page.get_text()
    print(f"\n━━━━━ Page {i+1} ━━━━━")
    print(text)
