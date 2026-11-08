package com.livingdocs.identity.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "livingdocs.identity")
public record IdentityProperties(
        @DefaultValue("7d") Duration refreshTokenTtl,
        @DefaultValue("Developer") String defaultRole) {
}
