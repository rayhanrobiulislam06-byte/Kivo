package com.kivo.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final int PICK_MODEL = 1001;

    private static final String MODEL_NAME =
            "gemma-4-E2B-it.litertlm";

    private KivoChatEngine chatEngine;

    private TextView responseText;
    private TextView subtitle;
    private EditText input;
    private TextView send;

    private boolean engineReady = false;
    private boolean engineLoading = false;
    private boolean copyingModel = false;

    private final int DARK = Color.rgb(35, 35, 35);
    private final int TEXT = Color.rgb(25, 25, 25);
    private final int MUTED = Color.rgb(110, 110, 110);

    private int dp(float value) {
        return (int) (value * getResources()
                .getDisplayMetrics().density + 0.5f);
    }

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setTypeface(Typeface.create("sans", Typeface.NORMAL));
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
        root.setBackgroundColor(Color.WHITE);

        // =========================
        // TOP BAR
        // =========================

        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(12), 0, dp(12), 0);

        TextView menu = text("☰", 25, TEXT);
        menu.setGravity(Gravity.CENTER);

        topBar.addView(
                menu,
                new LinearLayout.LayoutParams(dp(48), dp(58))
        );

        TextView title = text("Kivo", 20, TEXT);
        title.setTypeface(
                Typeface.create("sans", Typeface.BOLD)
        );

        LinearLayout.LayoutParams titleParams =
                new LinearLayout.LayoutParams(
                        0,
                        dp(58),
                        1
                );

        topBar.addView(title, titleParams);

        TextView newChat = text("＋", 28, TEXT);
        newChat.setGravity(Gravity.CENTER);

        topBar.addView(
                newChat,
                new LinearLayout.LayoutParams(dp(48), dp(58))
        );

        root.addView(
                topBar,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(58)
                )
        );

        // =========================
        // CONTENT
        // =========================

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(
                dp(24),
                dp(40),
                dp(24),
                dp(20)
        );

        TextView icon = text("K", 30, Color.WHITE);
        icon.setGravity(Gravity.CENTER);
        icon.setTypeface(
                Typeface.create("sans", Typeface.BOLD)
        );
        icon.setBackgroundColor(DARK);

        content.addView(
                icon,
                new LinearLayout.LayoutParams(
                        dp(64),
                        dp(64)
                )
        );

        TextView heading =
                text("How can I help you?", 24, TEXT);

        heading.setGravity(Gravity.CENTER);

        LinearLayout.LayoutParams headingParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );

        headingParams.topMargin = dp(20);

        content.addView(heading, headingParams);

        subtitle =
                text("Ask anything and chat with Kivo.", 15, MUTED);

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

    private File getModelFile() {
        File modelDir =
                new File(getFilesDir(), "models");

        if (!modelDir.exists()) {
            modelDir.mkdirs();
        }

        return new File(modelDir, MODEL_NAME);
    }

    private void sendMessage() {

        String message =
                input.getText().toString().trim();

        if (message.isEmpty()) {
            return;
        }

        File modelFile = getModelFile();

        if (!modelFile.exists()) {
            subtitle.setText(
                    "Select the Gemma 4 E2B model file."
            );

            openModelPicker();
            return;
        }

        if (copyingModel) {
            Toast.makeText(
                    this,
                    "Gemma model is being installed...",
                    Toast.LENGTH_SHORT
            ).show();
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

    private void openModelPicker() {

        Intent intent =
                new Intent(Intent.ACTION_OPEN_DOCUMENT);

        intent.addCategory(
                Intent.CATEGORY_OPENABLE
        );

        intent.setType("*/*");

        startActivityForResult(
                intent,
                PICK_MODEL
        );
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {
        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (requestCode != PICK_MODEL ||
                resultCode != RESULT_OK ||
                data == null ||
                data.getData() == null) {

            subtitle.setText(
                    "Gemma 4 E2B model is required."
            );

            return;
        }

        Uri uri = data.getData();

        try {
            getContentResolver().takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Throwable ignored) {
            // Some providers do not support persistable permission.
        }

        installModel(uri);
    }

    private void installModel(Uri sourceUri) {

        if (copyingModel) {
            return;
        }

        copyingModel = true;
        send.setEnabled(false);

        subtitle.setText(
                "Installing Gemma 4 E2B..."
        );

        new Thread(() -> {

            File destination = getModelFile();
            File temp = new File(
                    destination.getParentFile(),
                    MODEL_NAME + ".part"
            );

            try (
                    InputStream inputStream =
                            getContentResolver()
                                    .openInputStream(sourceUri);

                    OutputStream outputStream =
                            new FileOutputStream(temp)
            ) {

                if (inputStream == null) {
                    throw new IllegalStateException(
                            "Could not open model file."
                    );
                }

                byte[] buffer =
                        new byte[1024 * 1024];

                long copied = 0;
                int read;

                while ((read =
                        inputStream.read(buffer)) != -1) {

                    outputStream.write(
                            buffer,
                            0,
                            read
                    );

                    copied += read;

                    final long progressMB =
                            copied / (1024 * 1024);

                    runOnUiThread(() ->
                            subtitle.setText(
                                    "Installing Gemma 4 E2B... "
                                    + progressMB
                                    + " MB"
                            )
                    );
                }

                outputStream.flush();

                if (!temp.renameTo(destination)) {

                    try (FileInputStream in =
                                 new FileInputStream(temp);
                         FileOutputStream out =
                                 new FileOutputStream(destination)) {

                        byte[] buffer2 =
                                new byte[1024 * 1024];

                        int n;

                        while ((n = in.read(buffer2)) != -1) {
                            out.write(buffer2, 0, n);
                        }

                        out.flush();
                    }

                    temp.delete();
                }

                copyingModel = false;

                runOnUiThread(() -> {

                    send.setEnabled(true);

                    subtitle.setText(
                            "Gemma 4 E2B installed. Kivo is ready."
                    );

                    Toast.makeText(
                            MainActivity.this,
                            "Gemma 4 E2B installed successfully.",
                            Toast.LENGTH_LONG
                    ).show();
                });

            } catch (Throwable error) {

                temp.delete();

                copyingModel = false;

                runOnUiThread(() -> {

                    send.setEnabled(true);

                    subtitle.setText(
                            "Gemma model installation failed."
                    );

                    Toast.makeText(
                            MainActivity.this,
                            "Model error: "
                                    + error.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                });
            }

        }).start();
    }

    private void initializeEngine(
            File modelFile,
            String firstMessage
    ) {

        engineLoading = true;
        send.setEnabled(false);

        subtitle.setText(
                "Starting Gemma 4 E2B..."
        );

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
                            "Gemma 4 E2B is ready."
                    );

                    runMessage(firstMessage);
                });

            } catch (Throwable error) {

                engineReady = false;
                engineLoading = false;

                runOnUiThread(() -> {

                    send.setEnabled(true);

                    subtitle.setText(
                            "Gemma 4 E2B could not start."
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

        subtitle.setText(
                "Kivo is thinking..."
        );

        responseText.setVisibility(
                View.VISIBLE
        );

        responseText.setText(
                "Thinking..."
        );

        chatEngine.sendMessageAsyncJava(
                message,
                new KivoChatEngine.Callback() {

                    @Override
                    public void onResponse(
                            String response
                    ) {

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
                    public void onError(
                            Throwable error
                    ) {

                        runOnUiThread(() -> {

                            send.setEnabled(true);

                            subtitle.setText(
                                    "Gemma 4 E2B encountered an error."
                            );

                            responseText.setText(
                                    "Sorry, Kivo could not generate a response."
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
            try {
                chatEngine.close();
            } catch (Throwable ignored) {
            }
        }

        super.onDestroy();
    }
}
