import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/http.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ error: 'Validation failed', details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}` });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
};
