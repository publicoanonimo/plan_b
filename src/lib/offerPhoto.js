// Limit includes the base64 representation stored in Firestore, not just JPEG bytes.
export const MAX_PHOTO_LENGTH = 280 * 1024;
export function validateOfferPhoto(photo) {
  if (photo === null) return;
  if (typeof photo !== 'string' || photo.length > MAX_PHOTO_LENGTH || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo)) {
    throw new Error('La foto debe ser un JPEG comprimido de hasta 280 KB. Vuelve a seleccionarla.');
  }
}

export async function compressOfferPhoto(file) {
  if (!file || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Selecciona una foto JPG, PNG, WebP o AVIF.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La foto original debe pesar como máximo 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('invalid image');
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.68, 0.5, 0.35]) {
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (photo.length <= MAX_PHOTO_LENGTH) {validateOfferPhoto(photo); return photo;}
    }
    throw new Error('La foto tiene demasiado detalle. Prueba con otra imagen.');
  } catch (error) {
    if (error.message.startsWith('La foto')) throw error;
    throw new Error('No se pudo leer la foto. Prueba con otra imagen JPG, PNG, WebP o AVIF.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
