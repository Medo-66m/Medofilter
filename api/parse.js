const zlib = require("zlib");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readZip(buffer) {
  const entries = {};
  let eocd = -1;

  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error("مش قادر أفتح ملف Excel. لو الملف XLS قديم احفظه XLSX وجرب تاني.");
  }

  const total = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);

  let ptr = cdOffset;

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.slice(ptr + 46, ptr + 46 + nameLen).toString("utf8");

    if (buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const lnameLen = buffer.readUInt16LE(localOffset + 26);
      const lextraLen = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lnameLen + lextraLen;
      const comp = buffer.slice(dataStart, dataStart + compSize);

      let data = null;

      if (method === 0) {
        data = comp;
      }

      if (method === 8) {
        data = zlib.inflateRawSync(comp);
      }

      if (data) {
        entries[name] = data.toString("utf8");
      }
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(value) {
  return xmlDecode(String(value || "").replace(/<[^>]*>/g, ""));
}

function parseSharedStrings(xml) {
  const result = [];

  if (!xml) return result;

  const re = /<si[\s\S]*?<\/si>/g;
  let match;

  while ((match = re.exec(xml))) {
    const si = match[0];
    const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)];

    if (parts.length) {
      result.push(parts.map(p => xmlDecode(p[1])).join(""));
    } else {
      result.push(stripTags(si));
    }
  }

  return result;
}

function colIndex(ref) {
  const letters = (String(ref).match(/[A-Z]+/i) || [""])[0].toUpperCase();

  let n = 0;

  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }

  return n - 1;
}

function parseWorksheet(xml, shared) {
  const rows = [];

  if (!xml) return rows;

  const rowRe = /<row\b[\s\S]*?<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRe.exec(xml))) {
    const rowXml = rowMatch[0];
    const cells = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;

    let cellMatch;

    while ((cellMatch = cellRe.exec(rowXml))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];

      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1] || "";
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || "";

      let value = "";

      if (type === "inlineStr") {
        const inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        value = inline ? xmlDecode(inline[1]) : stripTags(body);
      } else {
        const v = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        value = v ? xmlDecode(v[1]) : "";

        if (type === "s") {
          value = shared[Number(value)] ?? "";
        }
      }

      cells[colIndex(ref)] = value;
    }

    if (cells.some(v => String(v || "").trim() !== "")) {
      rows.push(cells.map(v => v ?? ""));
    }
  }

  return rows;
}

function extractRowsFromXlsx(buffer) {
  const entries = readZip(buffer);
  const shared = parseSharedStrings(entries["xl/sharedStrings.xml"]);

  const sheetNames = Object.keys(entries)
    .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort();

  let rows = [];

  for (const name of sheetNames) {
    rows = rows.concat(parseWorksheet(entries[name], shared));
  }

  return rows;
}

function normalizeArabicDigits(text) {
  return String(text || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function normalizeNumber(value) {
  let number = normalizeArabicDigits(value).trim();

  number = number.replace(/\+/g, "");
  number = number.replace(/[^\d]/g, "");

  if (number.startsWith("00") && number.length > 11) {
    number = number.slice(2);
  }

  return number;
}

function isValidPhoneNumber(number) {
  return /^\d{10,15}$/.test(number);
}

function cleanText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function inferCountryFromRange(rangeValue) {
  const text = String(rangeValue || "").trim();
  const country = text.replace(/[0-9]+.*$/g, "").trim();

  return country || "Unknown Country";
}

function findHeaderIndex(row, names) {
  const lowerNames = names.map(n => String(n).trim().toLowerCase());

  for (let i = 0; i < row.length; i++) {
    const cell = String(row[i] || "").trim().toLowerCase();

    if (lowerNames.includes(cell)) {
      return i;
    }
  }

  return -1;
}

function addNumberRow(numberValue, rangeValue, countryValue, rows) {
  const number = normalizeNumber(numberValue);

  if (!isValidPhoneNumber(number)) return;

  const range = cleanText(rangeValue, "Unknown Range");

  let country = cleanText(countryValue, "Unknown Country");

  if (country === "Unknown Country" && range !== "Unknown Range") {
    country = inferCountryFromRange(range);
  }

  rows.push({
    number,
    range,
    country
  });
}

function extractNumbersFromText(text) {
  const rows = [];
  const matches = normalizeArabicDigits(text).match(/\+?\d[\d\s().\-_/]{8,}\d/g) || [];

  for (const match of matches) {
    const number = normalizeNumber(match);

    if (isValidPhoneNumber(number)) {
      rows.push({
        number,
        range: "Unknown Range",
        country: "Unknown Country"
      });
    }
  }

  return rows;
}

function rowsToNumbers(rows) {
  const out = [];

  let headerRow = -1;
  let numberCol = -1;
  let rangeCol = -1;
  let countryCol = -1;

  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r];

    const nCol = findHeaderIndex(row, [
      "number",
      "numbers",
      "phone",
      "phones",
      "mobile",
      "msisdn",
      "رقم",
      "الرقم",
      "ارقام",
      "الأرقام",
      "رقم الهاتف"
    ]);

    if (nCol !== -1) {
      headerRow = r;
      numberCol = nCol;

      rangeCol = findHeaderIndex(row, [
        "range",
        "ranges",
        "prefix",
        "code",
        "رينج",
        "الرنج",
        "كود"
      ]);

      countryCol = findHeaderIndex(row, [
        "country",
        "countries",
        "nation",
        "country name",
        "الدولة",
        "دولة",
        "بلد"
      ]);

      break;
    }
  }

  if (numberCol !== -1) {
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];

      addNumberRow(
        row[numberCol],
        rangeCol !== -1 ? row[rangeCol] : "Unknown Range",
        countryCol !== -1 ? row[countryCol] : "Unknown Country",
        out
      );
    }

    return out;
  }

  for (const row of rows) {
    for (const cell of row) {
      const extracted = extractNumbersFromText(cell);

      for (const item of extracted) {
        out.push(item);
      }
    }
  }

  return out;
}

function uniqueRows(rows) {
  const seen = new Set();
  const result = [];

  for (const row of rows) {
    if (!seen.has(row.number)) {
      seen.add(row.number);
      result.push(row);
    }
  }

  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, {
      ok: false,
      error: "POST only"
    });
  }

  try {
    const buffer = await getRawBody(req);

    if (!buffer || !buffer.length) {
      return send(res, 400, {
        ok: false,
        error: "الملف فاضي أو موصلش للسيرفر."
      });
    }

    const rawName = req.headers["x-file-name"] || "file";

    let fileName = "file";

    try {
      fileName = decodeURIComponent(String(rawName));
    } catch {
      fileName = String(rawName);
    }

    const ext = fileName.split(".").pop().toLowerCase();

    let allRows = [];

    if (["xlsx"].includes(ext)) {
      const sheetRows = extractRowsFromXlsx(buffer);
      allRows = rowsToNumbers(sheetRows);
    } else if (["csv", "txt", "log", "json", "html", "xml"].includes(ext)) {
      allRows = extractNumbersFromText(buffer.toString("utf8"));
    } else if (["xls"].includes(ext)) {
      return send(res, 400, {
        ok: false,
        error: "صيغة XLS القديمة مش مدعومة في النسخة دي. افتح الملف واعمله Save As بصيغة XLSX."
      });
    } else {
      allRows = extractNumbersFromText(buffer.toString("utf8"));
    }

    const rows = uniqueRows(allRows);

    const countrySet = new Set(
      rows
        .map(r => r.country)
        .filter(c => c && c !== "Unknown Country")
    );

    return send(res, 200, {
      ok: true,
      totalFound: allRows.length,
      rows,
      countryCount: countrySet.size
    });
  } catch (error) {
    return send(res, 500, {
      ok: false,
      error: error && error.message
        ? error.message
        : "حصل خطأ أثناء قراءة الملف."
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
