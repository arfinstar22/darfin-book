package id.darfinbook.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleAuthIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAuthIntent(intent);
    }

    private void handleAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if ("darfinbook".equalsIgnoreCase(uri.getScheme())) {
            String token = uri.getQueryParameter("token");
            if (token != null && !token.isEmpty()) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().postDelayed(() -> {
                        String js = "try { " +
                            "localStorage.setItem('darfin_token', '" + token + "'); " +
                            "window.postMessage({ type: 'DARFIN_AUTH_TOKEN', token: '" + token + "' }, '*'); " +
                            "window.location.href = '/?auth_token=" + token + "'; " +
                            "} catch(e) { " +
                            "window.location.href = 'https://darfin-book.onrender.com/?auth_token=" + token + "'; " +
                            "}";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }, 400);
                }
            }
        }
    }
}
