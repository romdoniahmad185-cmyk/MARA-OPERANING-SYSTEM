package com.mara.os;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;

    // =====================================================
    // MARA OS — HIDE SYSTEM UI
    // =====================================================

    private void hideSystemUI() {

        Window window = getWindow();

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // Jangan biarkan layar mati saat MARA OS aktif
        window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        int flags =
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;

        window.getDecorView().setSystemUiVisibility(flags);
    }


    // =====================================================
    // ON CREATE
    // =====================================================

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        // ==========================================
        // MARA OS FULL SCREEN
        // ==========================================

        hideSystemUI();


        // ==========================================
        // WEBVIEW MARA OS
        // ==========================================

        webView = new WebView(this);

        WebSettings settings =
                webView.getSettings();

        settings.setJavaScriptEnabled(true);

        settings.setDomStorageEnabled(true);

        settings.setAllowFileAccess(true);

        settings.setAllowContentAccess(true);

        // ==========================================
        // WEBVIEW CLIENT
        // ==========================================

        webView.setWebViewClient(
                new WebViewClient()
        );


        // ==========================================
        // WEBVIEW BACKGROUND
        // ==========================================

        webView.setBackgroundColor(
                Color.TRANSPARENT
        );


        // ==========================================
        // LOAD MARA OS
        // ==========================================

        webView.loadUrl(
                "file:///android_asset/index.html"
        );


        // ==========================================
        // TAMPILKAN MARA OS
        // ==========================================

        setContentView(webView);
    }


    // =====================================================
    // WINDOW FOCUS
    // =====================================================

    @Override
    public void onWindowFocusChanged(
            boolean hasFocus
    ) {

        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {

            hideSystemUI();
        }
    }


    // =====================================================
    // USER INTERACTION
    // =====================================================

    @Override
    public void onUserInteraction() {

        super.onUserInteraction();

        // Pastikan system UI tidak muncul kembali
        hideSystemUI();
    }


    // =====================================================
    // BACK BUTTON
    // =====================================================

    @Override
    public void onBackPressed() {

        if (
                webView != null &&
                webView.canGoBack()
        ) {

            webView.goBack();

        } else {

            super.onBackPressed();
        }
    }


    // =====================================================
    // DESTROY
    // =====================================================

    @Override
    protected void onDestroy() {

        if (webView != null) {

            webView.loadUrl(
                    "about:blank"
            );

            webView.stopLoading();

            webView.destroy();

            webView = null;
        }

        super.onDestroy();
    }
}