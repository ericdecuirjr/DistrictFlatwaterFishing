package com.districtflatwater.fishing;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;

/**
 * Imports a user-selected image before resizing. Requesting the Photo Picker's
 * location-sharing consent does not override the user's decision to redact GPS.
 * No photo is uploaded, and the original gallery item is never modified.
 */
@CapacitorPlugin(name = "DistrictPhotoImport", permissions = {
    @Permission(alias = "mediaLocation", strings = { Manifest.permission.ACCESS_MEDIA_LOCATION })
})
public class DistrictPhotoImportPlugin extends Plugin {
    private static final int MAX_BYTES = 35 * 1024 * 1024;
    // Available in Android's newer Photo Picker; older releases ignore this extra.
    private static final String REQUEST_PICKER_GPS = "android.provider.extra.REQUEST_LOCATION_METADATA_ACCESS";

    @PluginMethod
    public void pickOriginal(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                getPermissionState("mediaLocation") != PermissionState.GRANTED) {
            // Optional: denial still permits choosing the image with redacted metadata.
            requestPermissionForAlias("mediaLocation", call, "mediaPermissionResult");
        } else {
            openPicker(call);
        }
    }

    @PermissionCallback
    private void mediaPermissionResult(PluginCall call) {
        if (call != null) openPicker(call);
    }

    private void openPicker(PluginCall call) {
        boolean documents = Boolean.TRUE.equals(call.getBoolean("documents", false));
        Intent intent;
        if (!documents && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
            intent.setType("image/*");
            intent.putExtra(REQUEST_PICKER_GPS, true);
        } else {
            intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/*");
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "onPhotoSelected");
    }

    @ActivityCallback
    private void onPhotoSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK ||
                result.getData() == null || result.getData().getData() == null) {
            call.reject("Photo selection cancelled", "PHOTO_CANCELLED");
            return;
        }
        Uri picked = result.getData().getData();
        File local = null;
        try {
            ContentResolver resolver = getContext().getContentResolver();
            String mime = resolver.getType(picked);
            if (mime == null || !mime.startsWith("image/")) mime = "image/jpeg";
            local = File.createTempFile("df-photo-", ".img", getContext().getCacheDir());

            // A MediaStore original URI can expose full EXIF only after explicit
            // media-location permission. If it cannot be opened, respect the
            // picker-granted URI and its possible location redaction.
            Uri candidate = picked;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    getPermissionState("mediaLocation") == PermissionState.GRANTED) {
                try { candidate = MediaStore.setRequireOriginal(picked); }
                catch (RuntimeException ignored) { candidate = picked; }
            }
            try {
                copyPhoto(resolver, candidate, local);
            } catch (SecurityException | IOException originalUnavailable) {
                if (candidate.equals(picked)) throw originalUnavailable;
                copyPhoto(resolver, picked, local);
            }

            JSObject nativeExif = new JSObject();
            try {
                ExifInterface exif = new ExifInterface(local.getAbsolutePath());
                double[] coords = exif.getLatLong();
                if (coords != null && coords.length == 2 &&
                        Double.isFinite(coords[0]) && Double.isFinite(coords[1])) {
                    nativeExif.put("latitude", coords[0]);
                    nativeExif.put("longitude", coords[1]);
                }
                copyExifTag(exif, ExifInterface.TAG_DATETIME_ORIGINAL, "DateTimeOriginal", nativeExif);
                copyExifTag(exif, ExifInterface.TAG_OFFSET_TIME_ORIGINAL, "OffsetTimeOriginal", nativeExif);
                copyExifTag(exif, ExifInterface.TAG_DATETIME_DIGITIZED, "DateTimeDigitized", nativeExif);
            } catch (IOException ignored) {
                // The JavaScript reader can still inspect JPEG/PNG EXIF bytes.
            }

            JSObject response = new JSObject();
            response.put("fileUri", Uri.fromFile(local).toString());
            response.put("mimeType", mime);
            response.put("nativeExif", nativeExif);
            call.resolve(response);
        } catch (Exception e) {
            if (local != null) local.delete();
            call.reject("Could not read selected original photo: " + e.getMessage());
        }
    }

    private static void copyPhoto(ContentResolver resolver, Uri uri, File target) throws IOException {
        try (InputStream in = resolver.openInputStream(uri);
             FileOutputStream out = new FileOutputStream(target, false)) {
            if (in == null) throw new IOException("Photo file is unavailable");
            byte[] buffer = new byte[32768];
            int n, total = 0;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > MAX_BYTES) throw new IOException("Photo exceeds 35 MB limit");
                out.write(buffer, 0, n);
            }
            if (total == 0) throw new IOException("Photo is empty");
        }
    }

    private static void copyExifTag(ExifInterface exif, String tag, String key, JSObject output) {
        String value = exif.getAttribute(tag);
        if (value != null && !value.trim().isEmpty()) output.put(key, value);
    }

    @PluginMethod
    public void discardTemporary(PluginCall call) {
        String source = call.getString("fileUri", "");
        try {
            Uri uri = Uri.parse(source);
            String path = uri.getPath();
            if ("file".equals(uri.getScheme()) && path != null) {
                File temp = new File(path);
                if (temp.getName().matches("df-photo-[A-Za-z0-9]+\\.img") &&
                        temp.getCanonicalFile().getParentFile().equals(getContext().getCacheDir().getCanonicalFile())) {
                    temp.delete();
                }
            }
        } catch (IOException | RuntimeException ignored) {
            // Cache cleanup is best-effort and must never interrupt logging.
        }
        call.resolve();
    }
}
