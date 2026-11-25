package id.darfinbook.app;

import android.app.Dialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupInAppGoogleAuth();
        handleAuthIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAuthIntent(intent);
    }

    private void setupInAppGoogleAuth() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView mainWebView = getBridge().getWebView();
            WebSettings settings = mainWebView.getSettings();

            // 1. Remove "; wv" from User-Agent to prevent Google 403 disallowed_useragent
            String ua = settings.getUserAgentString();
            if (ua != null && ua.contains("; wv")) {
                settings.setUserAgentString(ua.replace("; wv", ""));
            }

            // 2. Enable multiple windows for in-app popup dialogs
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            // 3. Keep Google OAuth popups 100% inside the app using an in-app Dialog
            mainWebView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    Dialog popupDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                    WebView popupWebView = new WebView(MainActivity.this);

                    WebSettings pSettings = popupWebView.getSettings();
                    pSettings.setJavaScriptEnabled(true);
                    pSettings.setDomStorageEnabled(true);
                    pSettings.setSupportMultipleWindows(true);
                    pSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                    String pUa = pSettings.getUserAgentString();
                    if (pUa != null && pUa.contains("; wv")) {
                        pSettings.setUserAgentString(pUa.replace("; wv", ""));
                    }

                    popupWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                            if (request != null && request.getUrl() != null) {
                                Uri u = request.getUrl();
                                if ("darfinbook".equalsIgnoreCase(u.getScheme())) {
                                    MainActivity.this.handleAuthIntent(new Intent(Intent.ACTION_VIEW, u));
                                    popupDialog.dismiss();
                                    return true;
                                }
                            }
                            return false;
                        }
                    });

                    popupWebView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onCloseWindow(WebView window) {
                            popupDialog.dismiss();
                            window.destroy();
                        }
                    });

                    popupDialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
                        @Override
                        public void onDismiss(DialogInterface dialog) {
                            popupWebView.destroy();
                        }
                    });

                    popupDialog.setContentView(popupWebView, new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    ));

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(popupWebView);
                    resultMsg.sendToTarget();

                    popupDialog.show();
                    return true;
                }
            });
        }
    }

    private void handleAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if ("darfinbook".equalsIgnoreCase(uri.getScheme())) {
            String token = uri.getQueryParameter("token");
            if (token != null && !token.isEmpty()) {
                // Strict validation: must match valid JWT structure to prevent JS injection
                if (!token.matches("^[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+$")) {
                    return;
                }
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().postDelayed(() -> {
                        String quotedToken = org.json.JSONObject.quote(token);
                        String js = "try { " +
                            "localStorage.setItem('darfin_token', " + quotedToken + "); " +
                            "window.postMessage({ type: 'DARFIN_AUTH_TOKEN', token: " + quotedToken + " }, window.location.origin); " +
                            "window.location.href = '/?auth_token=' + encodeURIComponent(" + quotedToken + "); " +
                            "} catch(e) { " +
                            "window.location.href = 'https://darfin-book.onrender.com/?auth_token=' + encodeURIComponent(" + quotedToken + "); " +
                            "}";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }, 400);
                }
            }
        }
    }
}
