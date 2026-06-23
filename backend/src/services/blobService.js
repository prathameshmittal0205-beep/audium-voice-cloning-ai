const { put, del, head } = require('@vercel/blob');

async function uploadBuffer(buffer, filename, contentType, access = 'private') {
  const blob = await put(filename, buffer, {
    access: access,
    contentType,
    addRandomSuffix: true
  });
  return blob.url;
}

async function deleteBlob(url) {
  await del(url);
}

async function getBlobExists(url) {
  try {
    await head(url);
    return true;
  } catch {
    return false;
  }
}

module.exports = { uploadBuffer, deleteBlob, getBlobExists };
