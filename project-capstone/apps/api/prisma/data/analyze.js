const fs = require('fs');
const text = fs.readFileSync(__dirname + '/DATA_JAKSEL_FIXED_CLEANED.csv', 'utf8');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

const lines = text.split('\n').filter(l => l.trim());
const header = parseCSVLine(lines[0]);
console.log('Columns:', header);
console.log('Column count:', header.length);

const stores = {};
const kelurahan = {};
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const storeIdx = 7; // 'store' column index
  if (cols[storeIdx]) stores[cols[storeIdx]] = (stores[cols[storeIdx]] || 0) + 1;
  const kelIdx = 9; // nama_kelurahan
  if (cols[kelIdx]) kelurahan[cols[kelIdx]] = (kelurahan[cols[kelIdx]] || 0) + 1;
}
console.log('\nStores:', JSON.stringify(stores, null, 2));
console.log('\nKelurahan count:', Object.keys(kelurahan).length);
console.log('Sample rows:');
for (let i = 1; i <= 3; i++) {
  const cols = parseCSVLine(lines[i]);
  console.log(JSON.stringify(Object.fromEntries(header.map((h, idx) => [h + (idx === 8 ? '_2' : ''), cols[idx]]))));
}
