package com.livingdocs.integration.crypto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Xác thực chữ ký HMAC SHA-256 từ GitHub Webhook header X-Hub-Signature-256 (NFR-SEC-06).
 */
@Service
public class HmacSignatureVerifier {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String PREFIX = "sha256=";

    private final String webhookSecret;

    public HmacSignatureVerifier(
            @Value("${livingdocs.security.webhook-secret}") String webhookSecret
    ) {
        this.webhookSecret = webhookSecret;
    }

    /**
     * Xác thực header X-Hub-Signature-256 với raw payload body.
     */
    public boolean verifySignature(String rawBody, String signatureHeader) {
        if (signatureHeader == null || !signatureHeader.startsWith(PREFIX) || rawBody == null) {
            return false;
        }

        String expectedSignature = calculateSignature(rawBody, this.webhookSecret);
        byte[] expectedBytes = expectedSignature.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = signatureHeader.getBytes(StandardCharsets.UTF_8);

        // So sánh hằng số thời gian (Constant-time equality) để chống tấn công Timing Attacks
        return MessageDigest.isEqual(expectedBytes, providedBytes);
    }

    /**
     * Tính toán chữ ký HMAC SHA-256 kèm tiền tố "sha256=".
     */
    public String calculateSignature(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8),
                    HMAC_ALGORITHM
            );
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder(PREFIX);
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tính toán chữ ký HMAC: " + e.getMessage(), e);
        }
    }
}
