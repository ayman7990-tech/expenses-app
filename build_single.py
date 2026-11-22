# -*- coding: utf-8 -*-
"""يجمع index.html + style.css + app.js في ملف HTML واحد للتلفون."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
css  = (ROOT / "assets" / "css" / "style.css").read_text(encoding="utf-8")
js   = (ROOT / "assets" / "js" / "app.js").read_text(encoding="utf-8")

link = '<link rel="stylesheet" href="assets/css/style.css">'
script = '<script src="assets/js/app.js"></script>'

assert link in html, "لم أجد رابط الـ CSS"
assert script in html, "لم أجد رابط الـ JS"

single = html.replace(link, "<style>\n" + css + "\n</style>")
single = single.replace(script, "<script>\n" + js + "\n</script>")

out = ROOT / "مشروع_المصاريف_للتلفون.html"
out.write_text(single, encoding="utf-8")
print("تم:", out.name)
print("الحجم:", round(out.stat().st_size / 1024, 1), "كيلوبايت")
print("CSS مدمج:", "<style>" in single)
print("JS مدمج:", "function renderBudget" in single)
