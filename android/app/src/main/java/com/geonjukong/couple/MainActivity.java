package com.geonjukong.couple;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppBadgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
