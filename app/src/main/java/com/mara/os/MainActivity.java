package com.mara.os;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View screen = new View(this);
        screen.setBackgroundColor(Color.WHITE);

        setContentView(screen);
    }
}