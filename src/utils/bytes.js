function bytesToHuman(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

module.exports = { bytesToHuman };

