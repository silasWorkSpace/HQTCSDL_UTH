package com.livingdocs.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Load this service and shared components, without scanning peer services. */
@SpringBootApplication(scanBasePackages = {"com.livingdocs.identity", "com.livingdocs.common"})
public class IdentityApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityApplication.class, args);
    }
}
