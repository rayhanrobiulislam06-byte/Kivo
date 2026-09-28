package com.kivo.app;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.kivo.app.ai.KivoChatEngine;

import java.io.File;

public class MainActivity extends Activity {

    private KivoChatEngine chatEngine;

    private TextView responseText;
    private TextView subtitle;
    private EditText input;
    private TextView send;

    private boolean engineReady = false;
    private boolean engineLoading = false;

    private final int DARK = Color.rgb(35, 35, 35);
    private final int TEXT = Color.rgb(25, 25, 25);
    private final int MUTED = Color.rgb(110, 110, 110);

    private int dp(float value) {
        return (int) (
                value * getResources().getDisplayMetrics().density
                        + 0.5f
        );
    }

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);

        buildUi();
    }

    private void buildUi() {

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.FILL);
        root.setBackgroundColor(Color.WHITE);

        // =========================
        // TOP BAR
        // =========================

        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(8), 0, dp(8), 0);

        TextView menu = text("☰", 24, Color.rgb(40, 40, 40));
        menu.setGravity(Gravity.CENTER);

        topBar.addView(
                menu,
                new LinearLayout.LayoutParams(
                        dp(48),
                        dp(56)
                )
        );

        TextView logo = text("Kivo", 21, TEXT);
        logo.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        logo.setGravity(Gravity.CENTER_VERTICAL);

        topBar.addView(
                logo,
                new LinearLayout.LayoutParams(
                        0,
                        dp(56),
                        1
                )
        );

        TextView newChat = text("＋", 28, Color.rgb(40, 40, 40));
        newChat.setGravity(Gravity.CENTER);

        newChat.setOnClickListener(v -> {
            input.setText("");
            responseText.setText("");
            responseText.setVisibility(View.GONE);
            subtitle.setText("Ask anything and chat with Kivo.");
        });

        topBar.addView(
                newChat,
                new LinearLayout.LayoutParams(
                        dp(48),
                        dp(56)
                )
        );

        root.addView(
                topBar,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(56)
                )
        );

        // =========================
        // CENTER CONTENT
        // =========================

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(
                dp(16),
                dp(16),
                dp(16),
                dp(16)
        );

        TextView icon = text("K", 32, Color.WHITE);
        icon.setGravity(Gravity.CENTER);
        icon.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        icon.setBackgroundColor(DARK);

        LinearLayout.LayoutParams iconParams =
                new LinearLayout.LayoutParams(
                        dp(72),
                        dp(72)
                );

        iconParams.gravity = Gravity.CENTER_HORIZONTAL;
        iconParams.bottomMargin = dp(20);

        content.addView(icon, iconParams);

        TextView welcome =
                text(
                        "How can I help you?",
                        25,
                        TEXT
                );

        welcome.setGravity(Gravity.CENTER);
        welcome.setTypeface(
                Typeface.DEFAULT,
                Typeface.BOLD
        );

        content.addView(
                welcome,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );

        subtitle =
                text(
                        "Ask anything and chat with Kivo.",
                        15,
                        MUTED
                );

        subtitle.setGravity(Gravity.CENTER);

        LinearLayout.LayoutParams subtitleParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );

        subtitleParams.topMargin = dp(8);

        content.addView(subtitle, subtitleParams);

        responseText = text("", 16, TEXT);
        responseText.setGravity(Gravity.CENTER);
        responseText.setVisibility(View.GONE);

        LinearLayout.LayoutParams responseParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );

        responseParams.topMargin = dp(24);

        content.addView(responseText, responseParams);

        root.addView(
                content,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        0,
                        1
                )
        );

        // =========================
        // INPUT AREA
        // =========================

        LinearLayout inputArea = new LinearLayout(this);
        inputArea.setOrientation(LinearLayout.HORIZONTAL);
        inputArea.setGravity(Gravity.CENTER_VERTICAL);
        inputArea.setPadding(
                dp(12),
                dp(8),
                dp(12),
                dp(12)
        );

        input = new EditText(this);
        input.setHint("Ask Anything...");
        input.setTextSize(16);
        input.setSingleLine(false);
        input.setMinHeight(dp(52));
        input.setPadding(
                dp(16),
                dp(8),
                dp(16),
                dp(8)
        );

        inputArea.addView(
                input,
                new LinearLayout.LayoutParams(
                        0,
                        dp(52),
                        1
                )
        );

        send = text("↑", 27, Color.WHITE);
        send.setGravity(Gravity.CENTER);
        send.setBackgroundColor(DARK);

        send.setOnClickListener(v -> sendMessage());

        LinearLayout.LayoutParams sendParams =
                new LinearLayout.LayoutParams(
                        dp(52),
                        dp(52)
                );

        sendParams.leftMargin = dp(8);

        inputArea.addView(send, sendParams);

        root.addView(
                inputArea,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );

        setContentView(root);
    }

    private void sendMessage() {

        String message = input.getText()
                .toString()
                .trim();

        if (message.isEmpty()) {
            return;
        }

        // Model is intentionally not bundled yet.
        File modelFile = new File(
                getFilesDir(),
                "models/gemma-4-E2B-it.litertlm"
        );

        if (!modelFile.exists()) {
            Toast.makeText(
                    this,
                    "Kivo AI model is not installed yet.",
                    Toast.LENGTH_SHORT
            ).show();

            subtitle.setText(
                    "AI model is not installed yet."
            );

            return;
        }

        if (engineLoading) {
            Toast.makeText(
                    this,
                    "Kivo is starting the AI engine...",
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        if (!engineReady) {
            initializeEngine(modelFile, message);
            return;
        }

        runMessage(message);
    }

    private void initializeEngine(
            File modelFile,
            String firstMessage
    ) {

        engineLoading = true;

        send.setEnabled(false);
        subtitle.setText("Starting Kivo AI...");

        new Thread(() -> {

            try {

                chatEngine =
                        new KivoChatEngine(
                                modelFile.getAbsolutePath()
                        );

                chatEngine.initialize();

                engineReady = true;
                engineLoading = false;

                runOnUiThread(() -> {

                    send.setEnabled(true);
                    subtitle.setText(
                            "Kivo AI is ready."
                    );

                    runMessage(firstMessage);
                });

            } catch (Throwable error) {

                engineReady = false;
                engineLoading = false;

                runOnUiThread(() -> {

                    send.setEnabled(true);

                    subtitle.setText(
                            "Kivo AI could not start."
                    );

                    Toast.makeText(
                            MainActivity.this,
                            "AI engine error: "
                                    + error.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                });
            }

        }).start();
    }

    private void runMessage(String message) {

        input.setText("");
        send.setEnabled(false);

        subtitle.setText("Kivo is thinking...");

        responseText.setVisibility(View.VISIBLE);
        responseText.setText("Thinking...");

        chatEngine.sendMessageAsyncJava(
                message,
                new KivoChatEngine.Callback() {

                    @Override
                    public void onResponse(String response) {

                        runOnUiThread(() -> {

                            send.setEnabled(true);

                            subtitle.setText(
                                    "Ask anything and chat with Kivo."
                            );

                            responseText.setText(
                                    response.isEmpty()
                                            ? "No response."
                                            : response
                            );
                        });
                    }

                    @Override
                    public void onError(Throwable error) {

                        runOnUiThread(() -> {

                            send.setEnabled(true);

                            subtitle.setText(
                                    "Ask anything and chat with Kivo."
                            );

                            responseText.setText(
                                    "Kivo could not generate a response."
                            );

                            Toast.makeText(
                                    MainActivity.this,
                                    "AI error: "
                                            + error.getMessage(),
                                    Toast.LENGTH_LONG
                            ).show();
                        });
                    }
                }
        );
    }

    @Override
    protected void onDestroy() {

        if (chatEngine != null) {
            chatEngine.close();
            chatEngine = null;
        }

        super.onDestroy();
    }
}
