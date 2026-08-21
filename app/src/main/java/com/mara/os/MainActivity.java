package com.mara.os;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;


    // =====================================================
    // MARA OS — FULL SCREEN
    // =====================================================

    private void enableFullScreen() {

        Window window = getWindow();


        // -------------------------------------------------
        // HILANGKAN STATUS BAR
        // -------------------------------------------------

        window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );


        // -------------------------------------------------
        // LAYOUT SAMPAI UJUNG LAYAR
        // -------------------------------------------------

        window.getDecorView().setSystemUiVisibility(

                View.SYSTEM_UI_FLAG_LAYOUT_STABLE

                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN

                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION

                        | View.SYSTEM_UI_FLAG_FULLSCREEN

                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION

                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

        );


        // -------------------------------------------------
        // ANDROID 9+ — IZINKAN AREA NOTCH / CUTOUT
        // -------------------------------------------------

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {

            WindowManager.LayoutParams params =
                    window.getAttributes();

            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;

            window.setAttributes(params);
        }
    }


    // =====================================================
    // CREATE
    // =====================================================

    @Override
    protected void onCreate(
            Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);


        // -------------------------------------------------
        // FULLSCREEN DIJALANKAN SEBELUM WEBVIEW
        // -------------------------------------------------

        enableFullScreen();


        // =================================================
        // WEBVIEW
        // =================================================

        webView = new WebView(this);


        webView.setLayoutParams(
                new ViewGroup.LayoutParams(

                        ViewGroup.LayoutParams.MATCH_PARENT,

                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );


        // -------------------------------------------------
        // WEBVIEW TANPA PADDING
        // -------------------------------------------------

        webView.setPadding(
                0,
                0,
                0,
                0
        );


        // =================================================
        // WEB SETTINGS
        // =================================================

        WebSettings settings =
                webView.getSettings();

        settings.setJavaScriptEnabled(true);

        settings.setDomStorageEnabled(true);

        settings.setAllowFileAccess(true);

        settings.setAllowContentAccess(true);


        // =================================================
        // WEBVIEW CLIENT
        // =================================================

        webView.setWebViewClient(
                new WebViewClient()
        );


        // =================================================
        // MARA OS
        // =================================================

        webView.loadUrl(
                "file:///android_asset/index.html"
        );


        // =================================================
        // TAMPILKAN WEBVIEW
        // =================================================

        setContentView(webView);
    }


    // =====================================================
    // JAGA FULLSCREEN
    // =====================================================

    @Override
    public void onWindowFocusChanged(
            boolean hasFocus) {

        super.onWindowFocusChanged(
                hasFocus
        );


        if (hasFocus) {

            enableFullScreen();
        }
    }


    // =====================================================
    // BACK BUTTON
    // =====================================================

    @Override
    public void onBackPressed() {

        if (
                webView != null
                        &&
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