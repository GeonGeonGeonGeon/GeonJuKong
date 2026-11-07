export async function pickOrderedMedia(picker, convertFileSrc) {
  const selection = await picker.pick();
  if (!selection.files.length) return [];
  try {
    const files = [];
    for (const item of selection.files) {
      const response = await fetch(convertFileSrc(item.path));
      if (!response.ok) throw new Error('선택한 사진·동영상을 읽지 못했어요. 다시 선택해 주세요.');
      files.push(new File([await response.blob()], item.name, { type: item.type, lastModified: item.lastModified }));
    }
    return files;
  } finally {
    await picker.release({ selectionId: selection.selectionId });
  }
}
