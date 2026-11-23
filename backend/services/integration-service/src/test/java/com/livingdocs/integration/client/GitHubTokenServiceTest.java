package com.livingdocs.integration.client;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Jws;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GitHubTokenServiceTest {
    private static final String APP_ID = "123456";

    @Test
    void signsAppJwtWithGitHubDownloadedPkcs1Pem() throws Exception {
        KeyPair keyPair = generateRsaKeyPair();
        byte[] pkcs1 = PrivateKeyInfo.getInstance(keyPair.getPrivate().getEncoded())
                .parsePrivateKey().toASN1Primitive().getEncoded();
        assertSignedBy(keyPair, pem("RSA PRIVATE KEY", pkcs1));
    }

    @Test
    void continuesToAcceptPkcs8Pem() throws Exception {
        KeyPair keyPair = generateRsaKeyPair();
        assertSignedBy(keyPair, pem("PRIVATE KEY", keyPair.getPrivate().getEncoded()));
    }

    @Test
    void acceptsEscapedNewlinesAndSurroundingQuotesInPem() throws Exception {
        KeyPair keyPair = generateRsaKeyPair();
        byte[] pkcs1 = PrivateKeyInfo.getInstance(keyPair.getPrivate().getEncoded())
                .parsePrivateKey().toASN1Primitive().getEncoded();
        String rawPem = pem("RSA PRIVATE KEY", pkcs1);
        String escapedInQuotes = "\"" + rawPem.replace("\n", "\\n") + "\"";
        assertSignedBy(keyPair, escapedInQuotes);
    }

    @Test
    void acceptsBase64EncodedPem() throws Exception {
        KeyPair keyPair = generateRsaKeyPair();
        String rawPem = pem("PRIVATE KEY", keyPair.getPrivate().getEncoded());
        String b64 = Base64.getEncoder().encodeToString(rawPem.getBytes(StandardCharsets.UTF_8));
        assertSignedBy(keyPair, b64);
    }

    private static KeyPair generateRsaKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }

    private static void assertSignedBy(KeyPair keyPair, String privateKeyPem) {
        GitHubTokenService service = new GitHubTokenService(
                APP_ID, privateKeyPem, "https://api.github.com", null);

        String jwt = service.generateAppJwt();
        Jws<Claims> parsed = Jwts.parser()
                .verifyWith((RSAPublicKey) keyPair.getPublic())
                .build()
                .parseSignedClaims(jwt);

        assertEquals(APP_ID, parsed.getPayload().getIssuer());
        assertNotNull(parsed.getPayload().getExpiration());
    }

    private static String pem(String label, byte[] der) {
        String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
                .encodeToString(der);
        return "-----BEGIN " + label + "-----\n" + body + "\n-----END " + label + "-----\n";
    }
}
