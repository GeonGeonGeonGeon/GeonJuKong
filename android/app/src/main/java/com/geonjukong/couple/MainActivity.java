package com.geonjukong.couple;

import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppBadgePlugin.class);
        registerPlugin(OrderedMediaPickerPlugin.class);
        super.onCreate(savedInstanceState);
        keepWebViewAboveKeyboard();
    }

    // Capacitor's edge-to-edge margins only cover the system bars, so on Android 15+
    // the keyboard overlays a full-height WebView and hides inputs near the bottom.
    // Replace that listener under the same conditions and also leave room for the IME.
    private void keepWebViewAboveKeyboard() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;
        String mode = bridge.getConfig().adjustMarginsForEdgeToEdge();
        if ("disable".equals(mode)) return;
        if (!"force".equals(mode)) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM || !"auto".equals(mode)) return;
            TypedValue value = new TypedValue();
            boolean found = getTheme().resolveAttribute(android.R.attr.windowOptOutEdgeToEdgeEnforcement, value, true);
            if (found && value.data != 0) return;
        }
        WebView webView = bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
            params.leftMargin = bars.left;
            params.topMargin = bars.top;
            params.rightMargin = bars.right;
            params.bottomMargin = Math.max(bars.bottom, ime.bottom);
            view.setLayoutParams(params);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
