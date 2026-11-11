package com.geonjukong.couple;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.ext.SdkExtensions;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.UUID;

@CapacitorPlugin(name = "OrderedMediaPicker")
public class OrderedMediaPickerPlugin extends Plugin {
    // This API 36 extra is also supported by the photo picker on R extension 15.
    private static final String PRE_SELECTION_URIS = "android.provider.extra.PICKER_PRE_SELECTION_URIS";
    private boolean pending;
    private File selectionDirectory;

    private String pickerDevice() {
        android.content.SharedPreferences preferences = getContext().getSharedPreferences("media-picker", 0);
        String device = preferences.getString("device", null);
        if (device == null) {
            device = UUID.randomUUID().toString();
            preferences.edit().putString("device", device).apply();
        }
        return device;
    }

    @PluginMethod
    public void pick(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending || selectionDirectory != null) {
                call.reject("사진 선택이 끝날 때까지 기다려 주세요.");
                return;
            }
            try {
                boolean photoPicker = Build.VERSION.SDK_INT >= 33 ||
                    (Build.VERSION.SDK_INT >= 30 && SdkExtensions.getExtensionVersion(30) >= 2);
                boolean preselection = Build.VERSION.SDK_INT >= 36 ||
                    (Build.VERSION.SDK_INT >= 30 && SdkExtensions.getExtensionVersion(30) >= 15);
                Intent intent;
                ArrayList<Uri> selected = new ArrayList<>();
                if (photoPicker) {
                    intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
                    intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, MediaStore.getPickImagesMaxLimit());
                    intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_IN_ORDER, true);
                    if (preselection) {
                        JSArray requested = call.getArray("selectedAssets", new JSArray());
                        for (int i = 0; i < requested.length(); i++) {
                            org.json.JSONObject asset = requested.getJSONObject(i);
                            if (!pickerDevice().equals(asset.optString("device"))) continue;
                            Uri uri = Uri.parse(asset.getString("uri"));
                            if (!"content".equals(uri.getScheme()) || selected.contains(uri)) continue;
                            try (ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(uri, "r")) {
                                if (descriptor != null) selected.add(uri);
                            } catch (Exception ignored) {
                                // Keep attachments whose original is no longer available in this device's picker.
                            }
                        }
                        intent.putParcelableArrayListExtra(PRE_SELECTION_URIS, selected);
                    }
                } else {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                JSArray preselected = new JSArray();
                for (Uri uri : selected) preselected.put(uri.toString());
                call.getData().put("preselectedUris", preselected);
                call.getData().put("photoPicker", photoPicker);
                pending = true;
                startActivityForResult(call, intent, "picked");
            } catch (Exception error) {
                pending = false;
                call.reject("사진 선택창을 열지 못했어요. 다시 시도해 주세요.", error);
            }
        });
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) { pending = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK) {
            pending = false;
            call.resolve(new JSObject().put("cancelled", true).put("files", new JSArray()));
            return;
        }
        Intent data = result.getData();
        LinkedHashSet<Uri> uris = new LinkedHashSet<>();
        if (data != null) {
            ClipData clips = data.getClipData();
            if (clips != null) {
                for (int i = 0; i < clips.getItemCount(); i++) uris.add(clips.getItemAt(i).getUri());
            } else if (data.getData() != null) uris.add(data.getData());
        }
        execute(() -> loadSelection(call, uris));
    }

    private void loadSelection(PluginCall call, LinkedHashSet<Uri> uris) {
        ContentResolver resolver = getContext().getContentResolver();
        JSArray files = new JSArray(), selected = new JSArray();
        JSArray preselected = call.getArray("preselectedUris", new JSArray());
        boolean photoPicker = Boolean.TRUE.equals(call.getBoolean("photoPicker"));
        String device = pickerDevice();
        LinkedHashSet<String> existing = new LinkedHashSet<>();
        for (int i = 0; i < preselected.length(); i++) existing.add(preselected.optString(i));
        try {
            selectionDirectory = new File(getContext().getCacheDir(), "media-" + UUID.randomUUID());
            if (!selectionDirectory.mkdir()) throw new java.io.IOException("Could not create selection directory");
            for (Uri uri : uris) {
                selected.put(uri.toString());
                try { resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
                catch (SecurityException ignored) { /* Some document providers only grant temporary access. */ }
                if (existing.contains(uri.toString())) continue;
                String type = resolver.getType(uri);
                String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(type);
                String name = "photo" + (extension == null ? "" : "." + extension);
                try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0);
                }
                File target = new File(selectionDirectory, files.length() + (extension == null ? "" : "." + extension));
                ParcelFileDescriptor descriptor = resolver.openFileDescriptor(uri, "r");
                if (descriptor == null) throw new java.io.IOException("Could not open selected file");
                try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
                     FileOutputStream output = new FileOutputStream(target)) {
                    byte[] buffer = new byte[65536];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                }
                JSObject file = new JSObject().put("path", Uri.fromFile(target).toString()).put("name", name)
                    .put("type", type == null ? "" : type).put("lastModified", target.lastModified());
                if (photoPicker) file.put("pickerUri", uri.toString()).put("pickerDevice", device);
                files.put(file);
            }
            pending = false;
            JSObject response = new JSObject().put("selectionId", selectionDirectory.getName()).put("files", files);
            if (photoPicker) response.put("selectedUris", selected).put("preselectedUris", preselected).put("pickerDevice", device);
            call.resolve(response);
        } catch (Exception error) {
            clearSelection();
            pending = false;
            call.reject("선택한 사진·동영상을 읽지 못했어요. 다시 선택해 주세요.", error);
        }
    }

    @PluginMethod
    public void release(PluginCall call) {
        if (selectionDirectory == null || !selectionDirectory.getName().equals(call.getString("selectionId"))) {
            call.reject("사진 선택 임시 파일을 찾지 못했어요.");
            return;
        }
        if (clearSelection()) call.resolve();
        else call.reject("사진 선택 임시 파일을 정리하지 못했어요.");
    }

    private boolean clearSelection() {
        if (selectionDirectory == null) return true;
        File[] files = selectionDirectory.listFiles();
        if (files != null) for (File file : files) if (!file.delete()) return false;
        if (!selectionDirectory.delete()) return false;
        selectionDirectory = null;
        return true;
    }
}
