import { Router } from 'express';
import { isAdmin } from '../middlewares/role.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  listAudits,
  createAudit,
  deleteAudit,
  restoreAudit,
  auditMiddlewares,
} from '../controllers/audit.controller.js';

const router = Router();

// ─── GET /api/v1/audits ───────────────────────────────────────────────────────
// List semua audit dengan pagination, filter, dan search
router.get('/', ...auditMiddlewares.list, listAudits);

// ─── POST /api/v1/audits ──────────────────────────────────────────────────────
// HANYA ADMIN: buat audit baru secara atomik (Audit + Entity dalam 1 transaksi)
router.post('/', authenticate, isAdmin, ...auditMiddlewares.create, createAudit);

// ─── DELETE /api/v1/audits/:id ────────────────────────────────────────────────
// HANYA ADMIN: soft-delete (status → CANCELLED) — data tidak dihapus permanen
router.delete('/:id', authenticate, isAdmin, ...auditMiddlewares.delete, deleteAudit);

// ─── POST /api/v1/audits/:id/restore ─────────────────────────────────────────
// HANYA ADMIN: restore audit berstatus CANCELLED kembali ke PENDING
// ⚠ Rute ini HARUS didefinisikan SEBELUM /:id agar Express tidak salah match
router.post('/:id/restore', authenticate, isAdmin, ...auditMiddlewares.restore, restoreAudit);

export default router;