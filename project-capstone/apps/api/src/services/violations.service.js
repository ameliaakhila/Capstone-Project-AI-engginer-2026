// src/services/violation.service.js
import api from './api';

// ─── GET ────────────────────────────────────────────────
export const fetchViolations = async (params) => {
  const res = await api.get('/violations', { params });
  return res.data;
};

export const fetchViolationById = async (id) => {
  const res = await api.get(`/violations/${id}`);
  return res.data;
};

// ─── POST ───────────────────────────────────────────────
export const createViolation = async (payload) => {
  const res = await api.post('/violations', payload);
  return res.data;
};

// ─── PUT / PATCH ───────────────────────────────────────
export const updateViolation = async (id, payload) => {
  const res = await api.put(`/violations/${id}`, payload);
  return res.data;
};

export const patchViolation = async (id, payload) => {
  const res = await api.patch(`/violations/${id}`, payload);
  return res.data;
};

// ─── DELETE / RESTORE ──────────────────────────────────
export const deleteViolation = async (id) => {
  const res = await api.delete(`/violations/${id}`);
  return res.data;
};

export const restoreViolation = async (id) => {
  const res = await api.patch(`/violations/${id}/restore`);
  return res.data;
};