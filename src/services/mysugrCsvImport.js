/**
 * Parses mySugr-style CSV exports (and common variants): semicolon or comma,
 * flexible headers (Entry date, Glucose, mg/dL, etc.), local date+time → epoch ms.
 *
 * @param {string} rawText
 * @returns {{ readings: { value_mgdl: number, recorded_at: number, meal_context: string }[], parseErrors: string[] }}
 */
export function parseMySugrCsv(rawText) {
  const parseErrors = [];
  const readings = [];

  if (!rawText || typeof rawText !== 'string') {
    parseErrors.push('Empty file.');
    return { readings, parseErrors };
  }

  let text = rawText;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    parseErrors.push('No rows in file.');
    return { readings, parseErrors };
  }

  const first = lines[0];
  const sc = (first.match(/;/g) || []).length;
  const cc = (first.match(/,/g) || []).length;
  const delim = sc > cc ? ';' : ',';

  const splitRow = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        q = !q;
      } else if (!q && c === delim) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out.map((c) => c.replace(/^"|"$/g, '').trim());
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());

  const idxFor = (candidates) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      for (const c of candidates) {
        if (h.includes(c)) return i;
      }
    }
    return -1;
  };

  let iDate = idxFor(['entry date', 'date', 'day', 'datum', 'tag']);
  let iTime = idxFor(['entry time', 'time', 'uhrzeit', 'clock']);
  let iVal = idxFor([
    'blood sugar',
    'glucose',
    'mg/dl',
    'mg/dl)',
    'measurement',
    'bg',
    'value',
    'glukose',
    'zucker',
  ]);

  const dataStart = 1;

  if (iVal < 0) {
    const second = splitRow(lines[1] ?? '');
    const thirdCol = Number.parseFloat(String(second[2] ?? '').replace(',', '.'));
    if (second.length >= 3 && Number.isFinite(thirdCol) && thirdCol > 0) {
      iDate = 0;
      iTime = 1;
      iVal = 2;
    } else {
      parseErrors.push('Could not find a glucose value column. Expected headers like Entry date / Glucose (mg/dL).');
      return { readings, parseErrors };
    }
  }

  if (iDate < 0 || iTime < 0) {
    const tryOneCol = idxFor(['date time', 'datetime', 'timestamp']);
    if (tryOneCol >= 0) {
      iDate = tryOneCol;
      iTime = -1;
    }
  }

  for (let li = dataStart; li < lines.length; li++) {
    const cols = splitRow(lines[li]);
    if (cols.length < 2) continue;

    const dateStr = iDate >= 0 ? cols[iDate] : '';
    const timeStr = iTime >= 0 ? cols[iTime] : '';
    const valStr = iVal >= 0 ? cols[iVal] : '';

    const val = Number.parseFloat(String(valStr).replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0 || val > 900) continue;

    let recordedAt = NaN;
    if (iTime >= 0) {
      recordedAt = combineLocalDateTime(dateStr, timeStr, parseErrors);
    } else {
      recordedAt = parseSingleDateTime(dateStr, parseErrors);
    }

    if (!Number.isFinite(recordedAt)) continue;

    readings.push({
      value_mgdl: val,
      recorded_at: recordedAt,
      meal_context: 'imported',
    });
  }

  readings.sort((a, b) => a.recorded_at - b.recorded_at);

  if (!readings.length && !parseErrors.length) {
    parseErrors.push('No valid glucose rows found.');
  }

  return { readings, parseErrors };
}

function combineLocalDateTime(dateStr, timeStr, parseErrors) {
  const ds = String(dateStr).trim();
  const ts = String(timeStr).trim();
  if (!ds) return NaN;

  const ms = tryParseDateTime(ds, ts);
  let d = dateStr.trim();
  if (!Number.isFinite(ms)) {
    if (parseErrors.length < 5) parseErrors.push(`Bad date/time: "${ds}" "${ts}"`);
  }
  return ms;
}

function parseSingleDateTime(s, parseErrors) {
  const t = Date.parse(s.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
  if (Number.isFinite(t)) return t;
  if (parseErrors.length < 5) parseErrors.push(`Bad datetime: "${s}"`);
  return NaN;
}

function tryParseDateTime(dateStr, timeStr) {
  let d = dateStr.trim();
  let t = (timeStr || '12:00').trim();

  // Support: 14-May-2026
  d = d.replace(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
    (_, day, mon, year) => {
      const months = {
        Jan: '01',
        Feb: '02',
        Mar: '03',
        Apr: '04',
        May: '05',
        Jun: '06',
        Jul: '07',
        Aug: '08',
        Sep: '09',
        Oct: '10',
        Nov: '11',
        Dec: '12',
      };

      return `${year}-${months[mon]}-${day.padStart(2, '0')}`;
    }
  );

  // Support: 14.05.2026
  d = d.replace(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    '$3-$2-$1'
  );

  // Support: 14/05/2026
  d = d.replace(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    (_, a, b, y) => {
      const n1 = Number(a);
      const n2 = Number(b);

      if (n1 > 12) return `${y}-${a}-${b}`;
      if (n2 > 12) return `${y}-${b}-${a}`;

      return `${y}-${a}-${b}`;
    }
  );

  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const iso = `${d}T${normalizeTime(t)}`;
    const ms = Date.parse(iso);

    if (Number.isFinite(ms)) return ms;
  }

  const joined = `${d} ${t}`;
  const ms2 = Date.parse(joined);

  if (Number.isFinite(ms2)) return ms2;

  const ms3 = Date.parse(`${d}T${normalizeTime(t)}`);

  return ms3;
}

function normalizeTime(t) {
  if (/^\d{1,2}:\d{2}:\d{2}\s*(am|pm)$/i.test(t)) {
  const parts = t.match(/(\d+):(\d+):(\d+)\s*(am|pm)/i);

  if (parts) {
    let hours = parseInt(parts[1]);
    const minutes = parts[2];
    const seconds = parts[3];
    const ap = parts[4].toLowerCase();

    if (ap === 'pm' && hours < 12) hours += 12;
    if (ap === 'am' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  }
}
  return t;
}
