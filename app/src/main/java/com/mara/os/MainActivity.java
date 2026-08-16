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
    // MARA OS — FULL SCREEN SYSTEM UI
    // =====================================================

    private void setupFullscreen() {

        Window window = getWindow();

        // ==========================================
        // WINDOW BACKGROUND
        // ==========================================

        window.setBackgroundDrawableResource(
                android.R.color.transparent
        );

        window.setStatusBarColor(
                Color.TRANSPARENT
        );

        window.setNavigationBarColor(
                Color.TRANSPARENT
        );


        // ==========================================
        // KEEP SCREEN ON
        // ==========================================

        window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );


        // ==========================================
        // MARA OS FULLSCREEN FLAGS
        // ==========================================

        int flags =
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;


        window.getDecorView()
                .setSystemUiVisibility(flags);
    }


    // =====================================================
    // ON CREATE
    // =====================================================

    @Override
    protected void onCreate(
            Bundle savedInstanceState
    ) {

        super.onCreate(savedInstanceState);


        // ==========================================
        // FULLSCREEN
        // ==========================================

        setupFullscreen();


        // ==========================================
        // WEBVIEW
        // ==========================================

        webView = new WebView(this);


        // ==========================================
        // WEBVIEW LAYOUT
        // ==========================================

        webView.setLayoutParams(
                new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT
                )
        );


        // ==========================================
        // WEBVIEW BACKGROUND
        // ==========================================

        webView.setBackgroundColor(
                Color.TRANSPARENT
        );


        // ==========================================
        // SETTINGS
        // ==========================================

        WebSettings settings =
                webView.getSettings();

        settings.setJavaScriptEnabled(true);

        settings.setDomStorageEnabled(true);

        settings.setAllowFileAccess(true);

        settings.setAllowContentAccess(true);

        settings.setLoadWithOverviewMode(false);

        settings.setUseWideViewPort(false);


        // ==========================================
        // WEBVIEW CLIENT
        // ==========================================

        webView.setWebViewClient(
                new WebViewClient()
        );


        // ==========================================
        // LOAD MARA OS
        // ==========================================

        webView.loadUrl(
                "file:///android_asset/index.html"
        );


        // ==========================================
        // DISPLAY
        // ==========================================

        setContentView(webView);


        // ==========================================
        // APPLY FULLSCREEN LAGI
        // ==========================================

        webView.postDelayed(
                new Runnable() {

                    @Override
                    public void run() {

                        setupFullscreen();
                    }

                },
                100
        );
    }


    // =====================================================
    // WINDOW FOCUS
    // =====================================================

    @Override
    public void onWindowFocusChanged(
            boolean hasFocus
    ) {

        super.onWindowFocusChanged(
                hasFocus
        );

        if (hasFocus) {

            setupFullscreen();
        }
    }


    // =====================================================
    // USER INTERACTION
    // =====================================================

    @Override
    public void onUserInteraction() {

        super.onUserInteraction();

        setupFullscreen();
    }


    // =====================================================
    // BACK
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