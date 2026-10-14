import prisma from '../config/database.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_PRIORITY = ['HIGH', 'MEDIUM', 'LOW'];
const ALLOWED_STATUS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const ALLOWED_TYPE = ['PASAR', 'MINIMARKET', 'SUPERMARKET'];

// ─── Type Mapping ─────────────────────────────────────────────────────────────
// Memetakan input form (label UI) ke nilai enum yang diterima database.
// Kunci: input dari form (huruf besar), Nilai: enum Prisma yang valid.
const TYPE_MAP = {
  // Retail / Minimarket
  'RETAIL': 'MINIMARKET',
  'MINIMARKET': 'MINIMARKET',
  'TOKO': 'MINIMARKET',
  'WARUNG': 'MINIMARKET',

  // Pasar Tradisional
  'PASAR': 'PASAR',
  'TRADITIONAL': 'PASAR',
  'TRADISIONAL': 'PASAR',

  // Supermarket / Hypermarket
  'SUPERMARKET': 'SUPERMARKET',
  'HYPERMARKET': 'SUPERMARKET',
  'ZONASI': 'SUPERMARKET',
  'ZONA': 'SUPERMARKET',
};

/**
 * Konversi input tipe dari form ke nilai enum yang valid di database.
 * @param {string} rawType - Input mentah dari form (misal: 'Retail', 'pasar')
 * @returns {string} Nilai enum yang valid (misal: 'MINIMARKET', 'PASAR')
 */
const resolveEntityType = (rawType) => {
  const upper = String(rawType).toUpperCase().trim();
  return TYPE_MAP[upper] ?? upper; // jika tidak ada di map, kembalikan nilai aslinya (lalu akan gagal validasi ALLOWED_TYPE)
};

const generateAuditCode = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `#AUD-${Date.now()}-${random}`;
};

// ─── GET /api/v1/audits ───────────────────────────────────────────────────────
export const listAudits = async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      const s = String(status).toUpperCase();
      if (ALLOWED_STATUS.includes(s)) where.status = s;
    }
    if (priority) {
      const p = String(priority).toUpperCase();
      if (ALLOWED_PRIORITY.includes(p)) where.priority = p;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { findings: { contains: q, mode: 'insensitive' } },
        { entity: { name: { contains: q, mode: 'insensitive' } } },
        { district: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const allowedSortFields = ['createdAt', 'completedAt', 'priority', 'status', 'code'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [audits, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [safeSortBy]: safeSortOrder },
        include: {
          entity: {
            select: {
              id: true, name: true, type: true,
              address: true, permitStatus: true,
              complianceScore: true, isFlagged: true,
            },
          },
          district: {
            select: {
              id: true, name: true,
              status: true, saturationPercent: true,
            },
          },
        },
      }),
      prisma.audit.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    res.json({
      success: true,
      data: audits,
      pagination: {
        page: pageNum, limit: limitNum, total, totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/audits ──────────────────────────────────────────────────────
// Atomik: simpan ke tabel Audit (log) DAN Entity (master data) dalam 1 transaksi
export const createAudit = async (req, res, next) => {
  try {
    // ── 1. Ekstrak & validasi input ──────────────────────────────────────────
    const {
      // Data entity (master data baru)
      name,
      type = 'MINIMARKET',
      address,
      latitude,
      longitude,
      store,
      kelurahan,
      placeId,
      permitStatus = 'UNDER_REVIEW',
      complianceScore = 0,
      isFlagged = false,
      districtId,

      // Data audit (log riwayat)
      priority = 'MEDIUM',
      status = 'PENDING',
      findings,

      // Opsional: jika sudah ada entityId, tidak buat entity baru
      entityId,
    } = req.body;

    // Wajib ada districtId
    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: 'districtId wajib diisi',
      });
    }

    // Validasi enums — type melewati TYPE_MAP terlebih dahulu
    const normalizedType = resolveEntityType(type);   // 'Retail' → 'MINIMARKET'
    const normalizedPriority = String(priority).toUpperCase();
    const normalizedStatus = String(status).toUpperCase();

    if (!ALLOWED_TYPE.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipe entity tidak valid',
        allowedType: ALLOWED_TYPE,
      });
    }
    if (!ALLOWED_PRIORITY.includes(normalizedPriority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority audit tidak valid',
        allowedPriority: ALLOWED_PRIORITY,
      });
    }
    if (!ALLOWED_STATUS.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status audit tidak valid',
        allowedStatus: ALLOWED_STATUS,
      });
    }

    // ── 2. Pastikan district ada ─────────────────────────────────────────────
    const district = await prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true, name: true },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District tidak ditemukan',
      });
    }

    // ── 3. Jika pakai entityId existing, pastikan entity ada ────────────────
    if (entityId) {
      const existingEntity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!existingEntity) {
        return res.status(404).json({
          success: false,
          message: 'Entity tidak ditemukan',
        });
      }
    } else {
      // Wajib ada nama dan koordinat jika create entity baru
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'name entity wajib diisi (atau berikan entityId yang sudah ada)',
        });
      }
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'latitude dan longitude wajib diisi untuk entity baru',
        });
      }
    }

    // ── 4. Transaksi atomik ──────────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      let targetEntityId = entityId;

      // 4a. Jika tidak ada entityId → buat Entity baru sebagai master data
      if (!targetEntityId) {
        const newEntity = await tx.entity.create({
          data: {
            name: String(name),
            type: normalizedType,
            address: address ?? null,
            latitude: Number(latitude),
            longitude: Number(longitude),
            store: store ?? null,
            kelurahan: kelurahan ?? null,
            placeId: placeId ?? null,
            permitStatus: String(permitStatus).toUpperCase(),
            complianceScore: Number(complianceScore),
            isFlagged: Boolean(isFlagged),
            districtId,
          },
        });
        targetEntityId = newEntity.id;
      }

      // 4b. Buat Audit (log riwayat) — selalu dijalankan
      const newAudit = await tx.audit.create({
        data: {
          code: generateAuditCode(),
          priority: normalizedPriority,
          status: normalizedStatus,
          findings: findings ?? null,
          entityId: targetEntityId,
          districtId,
          completedAt: normalizedStatus === 'COMPLETED' ? new Date() : null,
        },
        include: {
          entity: {
            select: {
              id: true, name: true, type: true,
              address: true, permitStatus: true,
              complianceScore: true, isFlagged: true,
            },
          },
          district: {
            select: { id: true, name: true, status: true },
          },
        },
      });

      return newAudit;
    });

    res.status(201).json({
      success: true,
      message: entityId
        ? 'Audit berhasil dibuat dan ditautkan ke entity yang sudah ada'
        : 'Audit dan Entity baru berhasil dibuat secara atomik',
      data: result,
    });
  } catch (err) {
    // Tangani duplicate placeId (Prisma P2002)
    if (err.code === 'P2002' && err.meta?.target?.includes('placeId')) {
      return res.status(409).json({
        success: false,
        message: 'Entity dengan placeId ini sudah terdaftar',
      });
    }
    next(err);
  }
};

// ─── Middleware attachment helper (untuk dipakai di routes) ───────────────────
export const auditMiddlewares = {
  list: [authenticate],
  create: [authenticate, isAdmin],
  delete: [authenticate, isAdmin],
  restore: [authenticate, isAdmin],
};

// ─── DELETE /api/v1/audits/:id ────────────────────────────────────────────────
// HANYA ADMIN: Soft-delete — ubah status menjadi 'CANCELLED' (tidak hapus fisik)
// Relasi ke Entity dan District tetap utuh; data bisa di-restore kapanpun.
export const deleteAudit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Audit tidak ditemukan',
      });
    }

    if (existing.status === 'CANCELLED') {
      return res.status(409).json({
        success: false,
        message: 'Audit sudah dalam status CANCELLED',
      });
    }

    const updated = await prisma.audit.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: {
        id: true, code: true, status: true, priority: true,
        entity: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      message: 'Audit berhasil dihapus (soft-delete: status → CANCELLED)',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/audits/:id/restore ─────────────────────────────────────────
// HANYA ADMIN: Kembalikan audit berstatus CANCELLED ke PENDING
export const restoreAudit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Audit tidak ditemukan',
      });
    }

    if (existing.status !== 'CANCELLED') {
      return res.status(409).json({
        success: false,
        message: `Hanya audit berstatus CANCELLED yang bisa di-restore (saat ini: '${existing.status}')`,
      });
    }

    const updated = await prisma.audit.update({
      where: { id },
      data: { status: 'PENDING' },
      select: {
        id: true, code: true, status: true, priority: true,
        entity: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      message: 'Audit berhasil di-restore (status → PENDING)',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
