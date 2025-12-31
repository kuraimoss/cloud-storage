const filesRepo = require('../repositories/filesRepo');
const sharesRepo = require('../repositories/sharesRepo');
const { bytesToHuman } = require('../utils/bytes');

async function getDashboard(userId, storageQuotaBytes) {
  const [usedBytes, totalFiles, activeShares, files] = await Promise.all([
    filesRepo.getStorageUsageBytes(userId),
    filesRepo.countFilesByUser(userId),
    sharesRepo.countActiveSharesByUser(userId),
    filesRepo.listFilesByUser(userId),
  ]);

  const recentFiles = files.slice(0, 5).map((f) => ({
    id: f.id,
    name: f.original_name,
    mimeType: f.mime_type,
    sizeBytes: Number(f.size_bytes),
    createdAt: f.created_at,
  }));

  return {
    totalFiles,
    activeShares,
    storage: {
      usedBytes: Number(usedBytes),
      quotaBytes: Number(storageQuotaBytes),
      usedHuman: bytesToHuman(usedBytes),
      quotaHuman: bytesToHuman(storageQuotaBytes),
      percent: storageQuotaBytes ? Math.min(100, (Number(usedBytes) / Number(storageQuotaBytes)) * 100) : 0,
    },
    recentFiles,
  };
}

module.exports = { getDashboard };
