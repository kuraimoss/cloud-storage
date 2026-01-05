function fileExtLower(name) {
  const parts = String(name || '').split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1].toLowerCase();
}

function detectPreviewKind({ mimeType, name }) {
  const mt = String(mimeType || '').toLowerCase();
  const ext = fileExtLower(name);

  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mt.startsWith('image/')) {
    if (mt === 'image/svg+xml' || ext === 'svg') return 'none';
    return 'image';
  }

  if (['mp4', 'webm'].includes(ext) || mt.startsWith('video/')) return 'video';
  if (['mp3', 'wav'].includes(ext) || mt.startsWith('audio/')) return 'audio';

  if (ext === 'pdf' || mt === 'application/pdf') return 'pdf';

  if (
    mt.startsWith('text/') ||
    ['application/json', 'application/x-ndjson', 'application/xml'].includes(mt) ||
    ['txt', 'json', 'md', 'log'].includes(ext)
  ) {
    return 'text';
  }

  if (
    ['docx', 'xlsx', 'pptx'].includes(ext) ||
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mt)
  ) {
    return 'office';
  }

  return 'none';
}

module.exports = { detectPreviewKind, fileExtLower };

