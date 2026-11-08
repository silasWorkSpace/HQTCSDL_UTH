package com.livingdocs.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** scanBasePackages = com.livingdocs de nhan cac cau hinh dung chung trong libs/common-*. */
@SpringBootApplication(scanBasePackages = "com.livingdocs")
public class IdentityApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityApplication.class, args);
    }
}
