export async function pickOrderedMedia(picker, convertFileSrc, entries = []) {
  const selectedAssets = entries.map(item => item.file || item.metadata).filter(file => file.pickerUri && file.pickerDevice)
    .map(file => ({ uri: file.pickerUri, device: file.pickerDevice }));
  const selection = await picker.pick({ selectedAssets });
  if (selection.cancelled || (!selection.files.length && !selection.selectedUris && !selection.selectionId)) return null;
  try {
    const files = [];
    for (const item of selection.files) {
      const response = await fetch(convertFileSrc(item.path));
      if (!response.ok) throw new Error('선택한 사진·동영상을 읽지 못했어요. 다시 선택해 주세요.');
      const file = new File([await response.blob()], item.name, { type: item.type, lastModified: item.lastModified });
      if (item.pickerUri) { file.pickerUri = item.pickerUri; file.pickerDevice = item.pickerDevice; }
      files.push(file);
    }
    return { files, selectedUris: selection.selectedUris, preselectedUris: selection.preselectedUris, pickerDevice: selection.pickerDevice };
  } finally {
    if (selection.selectionId) await picker.release({ selectionId: selection.selectionId });
  }
}
