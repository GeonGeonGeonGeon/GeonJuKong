package com.geonjukong.couple;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "AppBadge", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class AppBadgePlugin extends Plugin {
    private static final String CHANNEL = "unread-activity";
    private static final int NOTIFICATION_ID = 4101;

    @PluginMethod
    public void set(PluginCall call) {
        int count = Math.max(0, call.getInt("count", 0));
        if (count > 0 && Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            // Ask once; a denial must not cause a prompt on every refresh.
            if (!getContext().getSharedPreferences(CHANNEL, 0).getBoolean("requested", false)) {
                getContext().getSharedPreferences(CHANNEL, 0).edit().putBoolean("requested", true).apply();
                requestPermissionForAlias("notifications", call, "permissionResult");
                return;
            }
            call.resolve();
            return;
        }
        update(count);
        call.resolve();
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) update(Math.max(0, call.getInt("count", 0)));
        call.resolve();
    }

    private void update(int count) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (count == 0) {
            manager.cancel(NOTIFICATION_ID);
            return;
        }
        // Android launcher dots require an active notification.
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "읽지 않은 알림", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(true);
            manager.createNotificationChannel(channel);
        }
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(getContext(), 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(getContext(), CHANNEL) : new Notification.Builder(getContext());
        manager.notify(NOTIFICATION_ID, builder.setSmallIcon(R.drawable.ic_stat_activity)
            .setContentTitle("GeonJuKong").setContentText("확인하지 않은 알림이 있어요.")
            .setContentIntent(open).setNumber(1).setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).build());
    }
}
