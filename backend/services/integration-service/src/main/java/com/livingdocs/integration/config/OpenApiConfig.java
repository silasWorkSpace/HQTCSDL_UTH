package com.livingdocs.integration.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI integrationOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("LivingDocs Integration Service API")
                        .description("REST API quản lý kết nối GitHub App, Repository và Webhook Ingestion theo chuẩn SRS.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Hiếu aka silas (Integration Subsystem Lead)")
                                .email("silas@livingdocs.internal")))
                .servers(List.of(
                        new Server().url("http://localhost:8082").description("Development Local Server")
                ));
    }
}
