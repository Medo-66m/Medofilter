const XLSX = require("xlsx");

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

function normalizeArabicDigits(text) {
  return String(text || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function normalizeNumber(value) {
  let number = normalizeArabicDigits(value).trim();
  number = number.replace(/\+/g, "").replace(/[^\d]/g, "");
  if (number.startsWith("00") && number.length > 11) number = number.slice(2);
  return number;
}

function isValidPhoneNumber(number) {
  return /^\d{10,15}$/.test(number);
}

function cleanText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function findHeaderIndex(row, names) {
  const lowerNames = names.map(n => String(n).trim().toLowerCase());
  for (let i = 0; i < row.length; i++) {
    const cell = String(row[i] || "").trim().toLowerCase();
    if (lowerNames.includes(cell)) return i;
  }
  return -1;
}

function addNumberRow(numberValue, rangeValue, countryValue, rows) {
  const number = normalizeNumber(numberValue);
  if (!isValidPhoneNumber(number)) return;
  rows.push({
    number,
    range: cleanText(rangeValue, "Unknown Range"),
    country: cleanText(countryValue, "Unknown Country")
  });
}

function extractNumbersFromText(text) {
  const rows = [];
  const matches = normalizeArabicDigits(text).match(/\+?\d[\d\s().\-_/]{8,}\d/g) || [];
  for (const match of matches) {
    const number = normalizeNumber(match);
    if (isValidPhoneNumber(number)) {
      rows.push({ number, range: "Unknown Range", country: "Unknown Country" });
    }
  }
  return rows;
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

function extractFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });
  const finalRows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false
    });

    if (!rows.length) continue;

    let headerRow = -1;
    let numberCol = -1;
    let rangeCol = -1;
    let countryCol = -1;

    for (let r = 0; r < Math.min(rows.length, 35); r++) {
      const row = rows[r];

      const nCol = findHeaderIndex(row, [
        "number", "numbers", "phone", "phones", "mobile", "msisdn",
        "رقم", "الرقم", "ارقام", "الأرقام", "رقم الهاتف"
      ]);

      if (nCol !== -1) {
        headerRow = r;
        numberCol = nCol;

        rangeCol = findHeaderIndex(row, [
          "range", "ranges", "prefix", "code", "رينج", "الرنج", "كود"
        ]);

        countryCol = findHeaderIndex(row, [
          "country", "countries", "nation", "country name", "الدولة", "دولة", "بلد"
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
          finalRows
        );
      }
      continue;
    }

    for (const row of rows) {
      for (const cell of row) {
        const extracted = extractNumbersFromText(cell);
        for (const item of extracted) finalRows.push(item);
      }
    }
  }

  return finalRows;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "POST only" });
  }

  try {
    const buffer = await getRawBody(req);
    if (!buffer || !buffer.length) {
      return send(res, 400, { ok: false, error: "الملف فاضي أو موصلش للسيرفر." });
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

    if (["xlsx", "xls", "csv"].includes(ext)) {
      allRows = extractFromWorkbook(buffer);
    } else {
      allRows = extractNumbersFromText(buffer.toString("utf8"));
    }

    const rows = uniqueRows(allRows);
    const countrySet = new Set(
      rows
        .map(row => row.country)
        .filter(country => country && country !== "Unknown Country")
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
      error: error && error.message ? error.message : "حصل خطأ أثناء قراءة الملف."
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
