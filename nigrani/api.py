from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from nigrani import core
from nigrani.features import FEATURES

app = FastAPI(title="Nigrani surveillance API")
class Feat(BaseModel): features: dict[str, float]
@app.get("/health")
def health(): return {"ok": True, "model": core.bundle()["name"]}
@app.post("/score")
def score(f: Feat):
    miss = set(FEATURES) - set(f.features)
    if miss: raise HTTPException(422, f"missing features: {sorted(miss)}")
    return core.score(f.features)
@app.post("/explain")
def explain(f: Feat, top_k: int = 5):
    miss = set(FEATURES) - set(f.features)
    if miss: raise HTTPException(422, f"missing features: {sorted(miss)}")
    return core.explain(f.features, top_k)
@app.get("/alerts")
def alerts(limit: int = 20): return core.list_alerts(limit)
@app.get("/alerts/{alert_id}")
def alert(alert_id: str):
    try: return core.explain_alert(alert_id)
    except KeyError as e: raise HTTPException(404, str(e))
@app.get("/model-card")
def card(): return core.model_card()

from fastapi.responses import HTMLResponse

DASH = """<!doctype html><html><head><title>Nigrani analyst dashboard</title><style>
body{font-family:system-ui;margin:24px;background:#0b1020;color:#e6e9f2}.g{display:grid;grid-template-columns:1.2fr 1fr;gap:20px}.s{max-height:85vh;overflow:auto}table{border-collapse:collapse;width:100%}
td,th{padding:6px 10px;border-bottom:1px solid #263050;text-align:left}tr:hover{background:#17203d;cursor:pointer}
#d{align-self:start;padding:12px;background:#111a33;border-radius:8px;white-space:pre-wrap}.bar{background:#4f7cff;height:10px}</style></head>
<body><h2>Nigrani — surveillance alerts</h2><div class=g><div class=s><table id=t><tr><th>Alert</th><th>Account</th><th>Date</th><th>Score</th></tr></table></div><div id=d>Click an alert to see its SHAP drivers (red pushes toward alert, green away)</div></div>
<script>
fetch('/alerts?limit=50').then(r=>r.json()).then(a=>{const t=document.getElementById('t');a.forEach(x=>{const r=t.insertRow();
r.innerHTML=`<td>${x.alert_id}</td><td>${x.account}</td><td>${x.date}</td><td>${x.score}</td>`;r.onclick=()=>show(x.alert_id)})});
function show(id){fetch('/alerts/'+id).then(r=>r.json()).then(e=>{const m=Math.max(...e.top_reasons.map(r=>Math.abs(r.shap)));
document.getElementById('d').innerHTML=`<b>${id}</b> score ${e.score} (threshold ${e.threshold})<br><br>`+e.top_reasons.map(r=>
`${r.feature} = ${r.value} (SHAP ${r.shap>0?'+':''}${r.shap})<div class=bar style="width:${100*Math.abs(r.shap)/m}%;background:${r.shap>0?'#ff5a5a':'#4fd18b'}"></div>`).join('')})}
</script></body></html>"""
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(): return DASH
