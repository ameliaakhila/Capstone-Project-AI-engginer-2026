import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// ─── CSV Parser ──────────────────────────────────────────
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

/**
 * Generic CSV reader. By default maps every column by its header name.
 * Pass `duplicateKeyIndex` to rename a specific column index (used for
 * the raw entity CSVs that have a duplicate place_id column).
 */
function readCSV(filePath, { duplicateKeyIndex } = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      const key = (duplicateKeyIndex !== undefined && idx === duplicateKeyIndex)
        ? 'place_id_2'
        : h;
      row[key] = cols[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

/** Parse a CSV value to its most natural JS type (bool > number > string). */
function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

// ─── District Status Helper ───────────────────────────────
function getDistrictStatus(saturation) {
  if (saturation >= 90) return 'CRITICAL';
  if (saturation >= 80) return 'WARNING';
  if (saturation >= 70) return 'ELEVATED';
  if (saturation >= 50) return 'STABLE';
  return 'SAFE';
}

// ─── Data file paths ─────────────────────────────────────
const DATA = (file) => path.join(__dirname, 'data', file);

// ─── Main Seed Function ──────────────────────────────────
async function main() {
  console.log('🌱 Starting Zonify Database Seeder...\n');

  // ── 1. Clean existing data ──
  console.log('🗑️  Cleaning existing data...');
  await prisma.flaggedCluster.deleteMany();
  await prisma.aiForecast.deleteMany();
  await prisma.saturationLog.deleteMany();
  await prisma.audit.deleteMany();
  await prisma.violation.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.zoningRule.deleteMany();
  await prisma.district.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // ── 1.5. Seed Roles ──
  console.log('👥 Seeding roles...');
  const adminRole = await prisma.role.create({
    data: {
      id: 1,
      name: 'admin',
    },
  });
  const userRole = await prisma.role.create({
    data: {
      id: 2,
      name: 'user',
    },
  });
  console.log(`   ✅ Created admin and user roles`);

  // ── 2. Seed Districts (from districts.csv) ──
  console.log('📍 Seeding districts...');
  const districtRows = readCSV(DATA('districts.csv'));
  const districtMap = {};        // name → DB record
  const districtSaturation = {}; // name → saturation number (for saturation logs)

  for (const row of districtRows) {
    const saturation = parseFloat(row.saturation);
    const district = await prisma.district.create({
      data: {
        name: row.name,
        code: row.code,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        saturationPercent: saturation,
        status: getDistrictStatus(saturation),
      },
    });
    districtMap[row.name] = district;
    districtSaturation[row.name] = saturation;
  }
  console.log(`   ✅ Created ${Object.keys(districtMap).length} districts`);

  // ── 3. Seed Minimarket Entities (from jaksel_retail_final_v3.csv) ──
  console.log('🏪 Importing entities from CSV...');
  const rows = readCSV(DATA('jaksel_retail_final_v3.csv'), { duplicateKeyIndex: 8 });
  console.log(`   📄 Found ${rows.length} rows in CSV`);

  let importedCount = 0;
  let skippedCount = 0;
  const seenPlaceIds = new Set();

  for (const row of rows) {
    const district = districtMap[row.nama_kecamatan];
    if (!district) { skippedCount++; continue; }

    const placeId = row.place_id;
    if (seenPlaceIds.has(placeId)) { skippedCount++; continue; }
    seenPlaceIds.add(placeId);

    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) { skippedCount++; continue; }

    await prisma.entity.create({
      data: {
        name: row.nama_tempat || row.store || 'Unknown',
        type: 'MINIMARKET',
        store: row.store || 'Unknown',
        address: row.alamat_tempat || null,
        latitude: lat,
        longitude: lng,
        placeId: placeId || null,
        kelurahan: row.nama_kelurahan || null,
        rating: parseFloat(row.rating_tempat) || 0,
        totalRatings: parseInt(row.user_ratings_total) || 0,
        permitStatus: 'APPROVED',
        complianceScore: Math.floor(Math.random() * 30) + 70, // 70–100
        isFlagged: false,
        districtId: district.id,
      },
    });
    importedCount++;
  }
  console.log(`   ✅ Imported ${importedCount} minimarket entities (skipped ${skippedCount})`);

  // ── 4. Seed Pasar Entities (from jaksel_pasar_final.csv) ──
  console.log('🏬 Importing traditional markets (Pasar) from CSV...');
  const rowsPasar = readCSV(DATA('jaksel_pasar_final.csv'));
  console.log(`   📄 Found ${rowsPasar.length} rows in Pasar CSV`);

  let importedPasarCount = 0;
  let skippedPasarCount = 0;

  for (const row of rowsPasar) {
    let matchedDistrict = null;
    const districtFromColumn = row.kecamatan || row.nama_kecamatan;

    if (districtFromColumn && districtMap[districtFromColumn]) {
      matchedDistrict = districtMap[districtFromColumn];
    } else {
      // Fallback: cari nama kecamatan dari dalam string alamat
      const alamat = (row.alamat_tempat || '').toLowerCase();
      for (const distName of Object.keys(districtMap)) {
        if (alamat.includes(distName.toLowerCase())) {
          matchedDistrict = districtMap[distName];
          break;
        }
      }
    }

    if (!matchedDistrict) { skippedPasarCount++; continue; }

    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) { skippedPasarCount++; continue; }

    await prisma.entity.create({
      data: {
        name: row.nama_tempat || 'Unknown Pasar',
        type: 'PASAR',
        store: row.store || 'Pasar',
        address: row.alamat_tempat || null,
        latitude: lat,
        longitude: lng,
        placeId: row.place_id || null,
        rating: parseFloat(row.rating_tempat) || 0,
        totalRatings: parseInt(row.user_ratings_total) || 0,
        permitStatus: 'APPROVED',
        complianceScore: 95,
        isFlagged: false,
        districtId: matchedDistrict.id,
      },
    });
    importedPasarCount++;
  }
  console.log(`   ✅ Imported ${importedPasarCount} traditional markets (skipped ${skippedPasarCount})`);

  // ── 5. Seed Zoning Rules (from zoning_rules.csv) ──
  console.log('📏 Seeding zoning rules...');
  const ruleRows = readCSV(DATA('zoning_rules.csv'));
  const rules = [];

  for (const row of ruleRows) {
    const rule = await prisma.zoningRule.create({
      data: {
        name: row.name,
        ruleType: row.ruleType,
        minDistanceMeters: row.minDistanceMeters ? parseInt(row.minDistanceMeters) : null,
        maxEntitiesPerZone: row.maxEntitiesPerZone ? parseInt(row.maxEntitiesPerZone) : null,
        targetEntityType: row.targetEntityType || null,
        referenceEntityType: row.referenceEntityType || null,
      },
    });
    rules.push(rule);
  }
  console.log(`   ✅ Created ${rules.length} zoning rules`);

  // ── 6. Generate Violations (programmatic — depends on entity IDs) ──
  console.log('⚠️ Generating violations...');
  const minimarkets = await prisma.entity.findMany({
    where: { type: 'MINIMARKET' },
    take: 99, // <--- Kita ambil tepat 99 data minimarket
    include: { district: true },
  });

  const violationCodes = [];
  let vCount = 0;
  for (let i = 0; i < minimarkets.length; i++) { // <--- Loop berjalan sampai semua 99 data terproses
    const entity = minimarkets[i];
    const code = `#V-${8800 + i}`;
    violationCodes.push(code);
    const severity = i < 25 ? 'CRITICAL' : i < 60 ? 'WARNING' : 'ELEVATED';
    const status = 'ACTIVE'; // <--- Kita buat ACTIVE semua agar terbaca di dashboard utama

    await prisma.violation.create({
      data: {
        code,
        description: `${entity.name} melanggar aturan jarak < 500m dari pasar tradisional`,
        ruleType: 'PROXIMITY',
        severity,
        status,
        distanceM: Math.floor(Math.random() * 450) + 10,
        entityId: entity.id,
        districtId: entity.districtId,
        zoningRuleId: rules[0].id,
        detectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        resolvedAt: null,
      },
    });
    vCount++;

    // Berikan bendera melanggar pada tabel entitas minimarketnya
    await prisma.entity.update({
      where: { id: entity.id },
      data: { isFlagged: true, complianceScore: Math.floor(Math.random() * 40) + 20 },
    });
  }
  console.log(`   ✅ Created ${vCount} violations`);
  // console.log('⚠️  Generating violations...');
  // const minimarkets = await prisma.entity.findMany({
  //   where: { type: 'MINIMARKET' },
  //   take: 50,
  //   include: { district: true },
  // });

  // let vCount = 0;
  // for (let i = 0; i < Math.min(47, minimarkets.length); i++) {
  //   const entity = minimarkets[i];
  //   const code = `#V-${8800 + i}`;
  //   const severity = i < 12 ? 'CRITICAL' : i < 25 ? 'WARNING' : 'ELEVATED';
  //   const status = i < 35 ? 'ACTIVE' : 'RESOLVED';

  //   await prisma.violation.create({
  //     data: {
  //       code,
  //       description: i % 2 === 0
  //         ? `${entity.name} is within 400m of a traditional market`
  //         : `${entity.name} exceeds zone minimarket density limit`,
  //       ruleType: i % 2 === 0 ? 'PROXIMITY' : 'DENSITY',
  //       severity,
  //       status,
  //       distanceM: Math.floor(Math.random() * 350) + 50,
  //       entityId: entity.id,
  //       districtId: entity.districtId,
  //       zoningRuleId: i % 2 === 0 ? rules[0].id : rules[2].id,
  //       detectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
  //       resolvedAt: status === 'RESOLVED' ? new Date() : null,
  //     },
  //   });
  //   vCount++;

  //   if (status === 'ACTIVE') {
  //     await prisma.entity.update({
  //       where: { id: entity.id },
  //       data: { isFlagged: true, complianceScore: Math.floor(Math.random() * 40) + 20 },
  //     });
  //   }
  // }
  // console.log(`   ✅ Created ${vCount} violations`);

  // ── 7. Seed Audits (programmatic) ──
  console.log('📋 Seeding audits...');
  const auditEntities = minimarkets.slice(0, 20);
  for (let i = 0; i < auditEntities.length; i++) {
    const entity = auditEntities[i];
    await prisma.audit.create({
      data: {
        code: `#MZ-${9900 + i}-X`,
        priority: i < 5 ? 'HIGH' : i < 12 ? 'MEDIUM' : 'LOW',
        status: i < 10 ? 'COMPLETED' : 'PENDING',
        findings: i < 10 ? `Audit completed. ${i % 2 === 0 ? 'Violation confirmed' : 'Compliant'}` : null,
        entityId: entity.id,
        districtId: entity.districtId,
        completedAt: i < 10 ? new Date() : null,
      },
    });
  }
  console.log(`   ✅ Created ${auditEntities.length} audits`);

  // ── 8. Seed Saturation Logs — 4 weeks of history per district ──
  console.log('📊 Seeding saturation history...');
  let logCount = 0;
  for (const [name, district] of Object.entries(districtMap)) {
    const baseSaturation = districtSaturation[name];
    for (let week = 0; week < 4; week++) {
      const date = new Date();
      date.setDate(date.getDate() - week * 7);
      await prisma.saturationLog.create({
        data: {
          saturationPercent: baseSaturation + (Math.random() * 10 - 5),
          violationCount: Math.floor(Math.random() * 15) + 3,
          districtId: district.id,
          recordedAt: date,
        },
      });
      logCount++;
    }
  }
  console.log(`   ✅ Created ${logCount} saturation log entries`);

  // ── 9. Seed Flagged Clusters (from flagged_clusters.csv) ──
  console.log('🔴 Seeding flagged clusters...');
  const clusterRows = readCSV(DATA('flagged_clusters.csv'));
  let clusterCount = 0;

  for (const row of clusterRows) {
    const dist = districtMap[row.district];
    if (!dist) { console.warn(`   ⚠️  District "${row.district}" not found, skipping cluster`); continue; }
    await prisma.flaggedCluster.create({
      data: {
        streetName: row.streetName,
        description: row.description,
        entityCount: parseInt(row.entityCount),
        districtId: dist.id,
      },
    });
    clusterCount++;
  }
  console.log(`   ✅ Created ${clusterCount} flagged clusters`);

  // ── 10. Seed AI Forecasts (from ai_forecasts.csv) ──
  console.log('🤖 Seeding AI forecasts...');
  const forecastRows = readCSV(DATA('ai_forecasts.csv'));
  let forecastCount = 0;

  for (const row of forecastRows) {
    const dist = districtMap[row.district];
    if (!dist) { console.warn(`   ⚠️  District "${row.district}" not found, skipping forecast`); continue; }
    await prisma.aiForecast.create({
      data: {
        probability: parseInt(row.probability),
        prediction: row.prediction,
        timeframeMonths: parseInt(row.timeframeMonths),
        districtId: dist.id,
      },
    });
    forecastCount++;
  }
  console.log(`   ✅ Created ${forecastCount} AI forecasts`);

  // ── 11. Seed System Settings (from system_settings.csv) ──
  console.log('⚙️  Seeding system settings...');
  const settingRows = readCSV(DATA('system_settings.csv'));
  let settingCount = 0;

  for (const row of settingRows) {
    // Replace $NOW$ sentinel with the current ISO timestamp
    const rawValue = row.value === '$NOW$' ? new Date().toISOString() : row.value;
    await prisma.systemSetting.create({
      data: { key: row.key, value: parseValue(rawValue) },
    });
    settingCount++;
  }
  console.log(`   ✅ Created ${settingCount} system settings`);

  // ── Summary ──
  const counts = {
    districts: await prisma.district.count(),
    entities: await prisma.entity.count(),
    violations: await prisma.violation.count(),
    audits: await prisma.audit.count(),
    zoningRules: await prisma.zoningRule.count(),
    saturationLogs: await prisma.saturationLog.count(),
    flaggedClusters: await prisma.flaggedCluster.count(),
    forecasts: await prisma.aiForecast.count(),
    settings: await prisma.systemSetting.count(),
  };

  console.log('\n🎉 Seeding complete!');
  console.log('═══════════════════════════════════════');
  console.log(`   Districts:        ${counts.districts}`);
  console.log(`   Entities:         ${counts.entities}`);
  console.log(`   Violations:       ${counts.violations}`);
  console.log(`   Audits:           ${counts.audits}`);
  console.log(`   Zoning Rules:     ${counts.zoningRules}`);
  console.log(`   Saturation Logs:  ${counts.saturationLogs}`);
  console.log(`   Flagged Clusters: ${counts.flaggedClusters}`);
  console.log(`   AI Forecasts:     ${counts.forecasts}`);
  console.log(`   System Settings:  ${counts.settings}`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
