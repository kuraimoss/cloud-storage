const path = require('path');
const { z } = require('zod');
const { HttpError } = require('../utils/httpError');

const renameSchema = z.object({
  name: z.string().min(1).max(255),
});

function validateRename(input) {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Invalid file name');

  const name = parsed.data.name.trim();
  if (!name) throw new HttpError(400, 'Invalid file name');
  if (name.includes('\0')) throw new HttpError(400, 'Invalid file name');

  const ext = path.extname(name);
  const base = path.basename(name, ext);
  if (!base) throw new HttpError(400, 'Invalid file name');

  // Avoid path traversal and reserved separators.
  if (name.includes('/') || name.includes('\\')) throw new HttpError(400, 'Invalid file name');

  return name;
}

module.exports = { validateRename };

