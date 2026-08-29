#!/usr/bin/env python3
"""
Pull official NSE index history and write the return windows the site needs.

Runs on a schedule inside GitHub Actions, where there is no browser and so no
cross-origin restriction. The page then reads one small JSON file instead of
calling anything live, which is both faster and legitimate: the numbers come
from NSE's own published index history.

Writes assets/data/indices.json. Whatever cannot be fetched is simply left out
and the page shows a dash for it — nothing is ever estimated or filled in.
"""

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

INDICES = [
    ("NIFTY 50",            "nifty50"),
    ("NIFTY NEXT 50",       "niftynext50"),
    ("NIFTY MIDCAP 150",    "midcap150"),
    ("NIFTY SMALLCAP 250",  "smallcap250"),
    ("NIFTY 500",           "nifty500"),
]

CTX = ssl.create_default_context()


def http(url, data=None, headers=None, timeout=45):
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("User-Agent", UA)
    req.add_header("Accept-Language", "en-IN,en;q=0.9")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read().decode("utf-8", "replace")


# ----------------------------------------------------------- niftyindices --

def nifty_chunk(name, start, end):
    """One date range from NSE's index site. Returns [(date, close)]."""
    body = json.dumps({
        "cinfo": ("{'name':'%s','startDate':'%s','endDate':'%s','indexName':'%s'}"
                  % (name, start.strftime("%d-%b-%Y"), end.strftime("%d-%b-%Y"), name))
    }).encode()
    txt = http(
        "https://www.niftyindices.com/Backpage.aspx/getHistoricaldatatabletoString",
        data=body,
        headers={
            "Content-Type": "application/json; charset=UTF-8",
            "Referer": "https://www.niftyindices.com/reports/historical-data",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://www.niftyindices.com",
        },
    )
    rows = json.loads(json.loads(txt)["d"])
    out = []
    for row in rows:
        raw = row.get("HistoricalDate") or row.get("Date")
        close = row.get("CLOSE") or row.get("Close")
        if not raw or close in (None, "", "-"):
            continue
        try:
            d = datetime.strptime(raw.strip(), "%d %b %Y").date()
            out.append((d, float(str(close).replace(",", ""))))
        except ValueError:
            continue
    return out


def history(name):
    """Twenty-six years, pulled in chunks so no single request is too large."""
    today = date.today()
    series = {}
    start_year = today.year - 26
    for y in range(start_year, today.year + 1, 3):
        a = date(y, 1, 1)
        b = min(date(y + 2, 12, 31), today)
        if b < a:
            continue
        for attempt in range(3):
            try:
                for d, c in nifty_chunk(name, a, b):
                    series[d] = c
                break
            except Exception as exc:              # noqa: BLE001
                if attempt == 2:
                    print("  chunk %s %s-%s failed: %s" % (name, a, b, exc))
                time.sleep(2 + attempt * 3)
        time.sleep(1.0)
    return sorted(series.items())


# ------------------------------------------------------------- the maths --

def close_on_or_before(series, target):
    """The last traded close at or before a date, so holidays never break it."""
    lo, hi, best = 0, len(series) - 1, None
    while lo <= hi:
        mid = (lo + hi) // 2
        if series[mid][0] <= target:
            best = series[mid]
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def window(series, days=None, on=None, years=None):
    """Percentage change from a past date to the latest close."""
    if not series:
        return None
    last_d, last_c = series[-1]
    if on is not None:
        target = on
    elif years is not None:
        try:
            target = last_d.replace(year=last_d.year - years)
        except ValueError:                         # 29 February
            target = last_d.replace(year=last_d.year - years, day=28)
    else:
        target = last_d - timedelta(days=days)
    if target < series[0][0]:
        return None
    prev = close_on_or_before(series, target)
    if not prev or prev[1] <= 0 or prev[0] == last_d:
        return None
    change = (last_c / prev[1] - 1) * 100
    if years and years >= 3:
        change = ((last_c / prev[1]) ** (1.0 / years) - 1) * 100
    return round(change, 2)


def fy_start(d):
    """India's financial year opens on 1 April."""
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def build(series):
    last_d, last_c = series[-1]
    prev = series[-2][1] if len(series) > 1 else None
    return {
        "asOf": last_d.isoformat(),
        "level": round(last_c, 2),
        "today": round((last_c / prev - 1) * 100, 2) if prev else None,
        "m1": window(series, days=30),
        "m3": window(series, days=91),
        "m6": window(series, days=182),
        "fy": window(series, on=fy_start(last_d)),
        "cy": window(series, on=date(last_d.year - 1, 12, 31)),
        "y1": window(series, years=1),
        "y3": window(series, years=3),
        "y5": window(series, years=5),
        "y10": window(series, years=10),
        "y15": window(series, years=15),
        "y25": window(series, years=25),
        "points": len(series),
        "from": series[0][0].isoformat(),
    }


def main():
    out = {"generated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
           "source": "NSE Indices (niftyindices.com), official published closes",
           "indices": {}}
    ok = 0
    for name, key in INDICES:
        print("fetching %s ..." % name)
        try:
            series = history(name)
        except Exception as exc:                   # noqa: BLE001
            print("  failed entirely: %s" % exc)
            continue
        if len(series) < 200:
            print("  only %d closes, skipping" % len(series))
            continue
        out["indices"][key] = build(series)
        out["indices"][key]["name"] = name
        ok += 1
        print("  %d closes, %s to %s" % (len(series), series[0][0], series[-1][0]))

    if not ok:
        print("nothing fetched — leaving the existing file untouched")
        return 1

    path = os.path.join("assets", "data", "indices.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f, indent=1, sort_keys=True)
        f.write("\n")
    print("wrote %s with %d indices" % (path, ok))
    return 0


if __name__ == "__main__":
    sys.exit(main())
