import json, statistics as st, datetime as dt, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
tx = d['transactions']
by = {}
for t in tx:
    by.setdefault(t['operation'], []).append(t)
out = {}
for op, rows in by.items():
    g = [int(r['gasUsed']) for r in rows]
    p = [int(r['gasPrice'])/1e9 for r in rows]
    c = [float(r['gasCostEth']) for r in rows]
    out[op] = dict(n=len(rows), gas_min=min(g), gas_max=max(g), gas_mean=round(st.mean(g)),
                   gwei_median=round(st.median(p),3), gwei_min=round(min(p),3), gwei_max=round(max(p),3),
                   cost_eth_mean=st.mean(c))
reg = sorted([r for r in tx if r['operation']=='register_voter'], key=lambda r: r['timestamp'])
gaps=[]; blocks=[]
for a,b in zip(reg, reg[1:]):
    ta=dt.datetime.fromisoformat(a['timestamp'].replace('Z','+00:00')); tb=dt.datetime.fromisoformat(b['timestamp'].replace('Z','+00:00'))
    s=(tb-ta).total_seconds()
    if 0 < s < 120: gaps.append(s); blocks.append(b['blockNumber']-a['blockNumber'])
out['_register_interarrival_s']=dict(n=len(gaps), median=st.median(gaps), mean=round(st.mean(gaps),2), p90=sorted(gaps)[int(0.9*(len(gaps)-1))])
out['_register_block_gap']=dict(median=st.median(blocks), mean=round(st.mean(blocks),2))
out['_span']=[min(t['timestamp'] for t in tx), max(t['timestamp'] for t in tx)]
out['_total_eth']=sum(float(t['gasCostEth']) for t in tx)
print(json.dumps(out, indent=1))
json.dump(out, open(sys.argv[1].replace('.json','_stats.json'),'w'), indent=1)
