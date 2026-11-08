package com.livingdocs.identity.config;

import com.livingdocs.common.security.LdSecurityProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
@EnableConfigurationProperties(IdentityProperties.class)
public class IdentityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Ky JWT bang cung khoa HS256 voi bo giai ma trong common-security. */
    @Bean
    public JwtEncoder jwtEncoder(LdSecurityProperties props) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(props.secretKey().getEncoded()));
    }

    /** Hien nut Authorize (Bearer) trong Swagger UI. */
    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info().title("LivingDocs Identity API").version("0.1.0"))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
