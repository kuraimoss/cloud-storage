const fs = require('fs');
const path = require('path');

const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');

function ensureUploadsRoot() {
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
}

function getUserUploadDir(userId) {
  ensureUploadsRoot();
  const dir = path.join(uploadsRoot, String(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUserUploadDirPath(userId) {
  ensureUploadsRoot();
  return path.join(uploadsRoot, String(userId));
}

function getStoredFilePath(userId, storedName) {
  const dir = getUserUploadDir(userId);
  const filePath = path.join(dir, storedName);
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(dir) + path.sep;
  if (!resolved.startsWith(resolvedDir)) {
    throw new Error('Invalid stored path');
  }
  return resolved;
}

module.exports = {
  getStoredFilePath,
  getUserUploadDir,
  getUserUploadDirPath,
  uploadsRoot,
};
