package com.mara.os;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /*
         * Layar kosong MARA
         * Tidak menggunakan HTML, WebView,
         * JavaScript, atau service worker.
         */

        View emptyScreen = new View(this);

        emptyScreen.setBackgroundColor(Color.WHITE);

        setContentView(emptyScreen);
    }
}