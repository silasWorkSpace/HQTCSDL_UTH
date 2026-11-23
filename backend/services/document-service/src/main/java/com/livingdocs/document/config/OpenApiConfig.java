package com.livingdocs.document.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI documentOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("LivingDocs Document Service API")
                        .description("REST API quản lý vòng đời tài liệu, phiên bản bất biến, kiểm tra hash chain và sinh tài liệu qua AI.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Linh (Document & Governance Lead)")
                                .email("linh@livingdocs.internal")))
                .servers(List.of(
                        new Server().url("http://localhost:8083").description("Document Service Local Server")
                ))
                .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
                .components(new Components().addSecuritySchemes("Bearer Authentication",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Nhập Bearer JWT token")));
    }
}
