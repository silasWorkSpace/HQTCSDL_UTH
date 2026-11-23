package com.livingdocs.integration.crypto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class AesGcmEncryptionServiceTest {

    private AesGcmEncryptionService encryptionService;

    // 32-byte (256-bit) AES key base64
    private static final String TEST_KEY_BASE64 = Base64.getEncoder().encodeToString(
            "01234567890123456789012345678901".getBytes()
    );

    @BeforeEach
    void setUp() {
        encryptionService = new AesGcmEncryptionService(TEST_KEY_BASE64);
    }

    @Test
    @DisplayName("NFR-SEC-04: Mã hóa và giải mã đối xứng thành công")
    void testEncryptDecryptSuccess() {
        String originalToken = "ghp_SampleGitHubPersonalAccessToken1234567890";
        byte[] encrypted = encryptionService.encrypt(originalToken);

        assertNotNull(encrypted);
        assertTrue(encrypted.length > 28); // 12 bytes IV + length + 16 bytes Tag

        String decrypted = encryptionService.decrypt(encrypted);
        assertEquals(originalToken, decrypted);
    }

    @Test
    @DisplayName("NFR-SEC-04: Dữ liệu bị thay đổi (tampered) phải ném ngoại lệ xác thực GCM Tag")
    void testTamperedCiphertextThrowsException() {
        String token = "ghp_SecretTokenValue";
        byte[] encrypted = encryptionService.encrypt(token);

        // Can thiệp sửa đổi 1 byte cuối (phần Authentication Tag)
        encrypted[encrypted.length - 1] ^= 0x55;

        assertThrows(RuntimeException.class, () -> encryptionService.decrypt(encrypted));
    }

    @Test
    @DisplayName("Khóa không đủ 256-bit phải bị từ chối khi khởi tạo")
    void testInvalidKeyLengthThrows() {
        String shortKey = Base64.getEncoder().encodeToString("short_key".getBytes());
        assertThrows(IllegalArgumentException.class, () -> new AesGcmEncryptionService(shortKey));
    }
}
