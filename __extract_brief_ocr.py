import pdfplumber
import easyocr
import numpy as np
from pathlib import Path

reader = easyocr.Reader(['en'], gpu=False, verbose=False)
path = Path('Deployment App — Project Brief.pdf')
out_lines = []
with pdfplumber.open(path) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f'Processing page {i+1}')
        img = page.to_image(resolution=200).original
        arr = np.array(img)
        txt = reader.readtext(arr, detail=0)
        out_lines.append(f'=== page {i+1} ===')
        out_lines.extend(txt)
        out_lines.append('---')
Path('brief_ocr.txt').write_text('\n'.join(out_lines), encoding='utf-8')
print('Done')
