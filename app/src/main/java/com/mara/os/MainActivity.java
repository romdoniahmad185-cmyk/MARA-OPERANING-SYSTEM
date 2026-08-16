package com.mara.os;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;

public class MainActivity extends Activity {

private WebView webView;  

@Override  
protected void onCreate(Bundle savedInstanceState) {  
    super.onCreate(savedInstanceState);  

    Window window = getWindow();  

    // ==========================================  
    // MARA OS — FULL SCREEN  
    // ==========================================  

    window.setStatusBarColor(Color.TRANSPARENT);  
    window.setNavigationBarColor(Color.TRANSPARENT);  

window.setFlags(
        WindowManager.LayoutParams.FLAG_FULLSCREEN,
        WindowManager.LayoutParams.FLAG_FULLSCREEN
);
    window.getDecorView().setSystemUiVisibility(  

View.SYSTEM_UI_FLAG_FULLSCREEN
                    |            View.SYSTEM_UI_FLAG_LAYOUT_STABLE  
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN  
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION  
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION  
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY  
    );  

    // ==========================================
// WEBVIEW — FULL WINDOW
// ==========================================

webView = new WebView(this);

// Pastikan WebView memenuhi seluruh Window
webView.setLayoutParams(
        new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        )
);

WebSettings settings = webView.getSettings();

settings.setJavaScriptEnabled(true);
settings.setDomStorageEnabled(true);
settings.setAllowFileAccess(true);
settings.setAllowContentAccess(true);

webView.setWebViewClient(new WebViewClient());

webView.setBackgroundColor(Color.TRANSPARENT);

// Pastikan tidak ada padding dari WebView
webView.setPadding(0, 0, 0, 0);

webView.loadUrl(
        "file:///android_asset/index.html"
);

setContentView(webView);
@Override  
public void onWindowFocusChanged(boolean hasFocus) {  

    super.onWindowFocusChanged(hasFocus);  

    if (hasFocus) {  

        getWindow()  
                .getDecorView()  
                .setSystemUiVisibility(  
   View.SYSTEM_UI_FLAG_FULLSCREEN
                                |               View.SYSTEM_UI_FLAG_LAYOUT_STABLE  
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN  
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION  
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION  
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY  
                );  
    }  
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