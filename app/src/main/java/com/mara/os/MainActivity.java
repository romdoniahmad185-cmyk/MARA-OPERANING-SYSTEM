package com.mara.os;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);

        WebSettings settings = webView.getSettings();

        // MARA OS menggunakan HTML/CSS/JavaScript lokal
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        // Izinkan file lokal dari assets
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Tetap berada di dalam aplikasi MARA
        webView.setWebViewClient(new WebViewClient());

        // Background sementara jika HTML belum selesai dimuat
        webView.setBackgroundColor(Color.BLACK);

        // Muat UI MARA dari APK
        webView.loadUrl("file:///android_asset/index.html");

        setContentView(webView);
    }

    @Override
    public void onBackPressed() {

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {

        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.destroy();
        }

        super.onDestroy();
    }
}