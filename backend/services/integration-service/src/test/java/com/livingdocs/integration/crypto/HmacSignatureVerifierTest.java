package com.livingdocs.integration.crypto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HmacSignatureVerifierTest {

    private static final String TEST_SECRET = "super_secret_webhook_token_789";
    private HmacSignatureVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new HmacSignatureVerifier(TEST_SECRET);
    }

    @Test
    @DisplayName("NFR-SEC-06: Xác thực chữ ký HMAC SHA-256 hợp lệ")
    void testValidSignature() {
        String payload = "{\"action\":\"opened\",\"number\":42}";
        String signature = verifier.calculateSignature(payload, TEST_SECRET);

        assertTrue(verifier.verifySignature(payload, signature));
    }

    @Test
    @DisplayName("NFR-SEC-06: Payload bị sửa đổi phải bị từ chối xác thực")
    void testTamperedPayloadFails() {
        String originalPayload = "{\"action\":\"opened\",\"number\":42}";
        String signature = verifier.calculateSignature(originalPayload, TEST_SECRET);

        String tamperedPayload = "{\"action\":\"opened\",\"number\":43}";
        assertFalse(verifier.verifySignature(tamperedPayload, signature));
    }

    @Test
    @DisplayName("Chữ ký tính bằng secret khác phải bị từ chối")
    void testWrongSecretFails() {
        String payload = "{\"action\":\"opened\"}";
        String wrongSignature = verifier.calculateSignature(payload, "different_secret");

        assertFalse(verifier.verifySignature(payload, wrongSignature));
    }

    @Test
    @DisplayName("Thiếu tiền tố sha256= phải bị từ chối")
    void testMissingPrefixFails() {
        assertFalse(verifier.verifySignature("payload", "invalid_prefix_hash"));
    }
}
