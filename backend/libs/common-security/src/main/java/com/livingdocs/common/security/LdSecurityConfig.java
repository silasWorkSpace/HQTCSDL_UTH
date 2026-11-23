package com.livingdocs.common.security;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;

/**
 * Cau hinh bao mat dung chung cho moi service: xac thuc JWT (HS256), kiem tra vai tro phia server (@PreAuthorize),
 * dat tenant tu claim. Service nao scan package com.livingdocs se tu dung cau hinh nay.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(LdSecurityProperties.class)
public class LdSecurityConfig {

    @Bean
    public JwtDecoder jwtDecoder(LdSecurityProperties props, ObjectProvider<StringRedisTemplate> redisProvider) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(props.secretKey())
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
        validators.add(JwtValidators.createDefaultWithIssuer(props.issuer()));
        StringRedisTemplate redis = redisProvider.getIfAvailable();
        if (redis != null) {
            validators.add(new RedisDenylistValidator(redis));
        }
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    /** Claim "roles" -> quyen ROLE_<ten vai tro>, dung duoc voi hasRole('Manager'). */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, LdSecurityProperties props,
                                                   JwtAuthenticationConverter converter,
                                                   @Value("${COOKIE_SECURE:true}") boolean secureCookies,
                                                   Environment environment) throws Exception {
        List<String> open = new ArrayList<>(List.of(
                "/actuator/health/**", "/actuator/info",
                "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"));
        open.addAll(props.publicPaths());
        // DevTokenController itself only exists in the dev profile.  Its route must
        // be reachable without a JWT there, but must never become public in another
        // profile through a shared security configuration.
        if (java.util.Arrays.asList(environment.getActiveProfiles()).contains("dev")) {
            open.add("/api/v1/auth/dev-token");
        }

        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(open.toArray(String[]::new)).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .bearerTokenResolver(new CookieBearerTokenResolver())
                        .jwt(j -> j.jwtAuthenticationConverter(converter)))
                .addFilterBefore(new CsrfProtectionFilter(secureCookies), BearerTokenAuthenticationFilter.class)
                .addFilterAfter(new TenantFilter(), BearerTokenAuthenticationFilter.class);
        return http.build();
    }
}
