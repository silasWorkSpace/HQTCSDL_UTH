package com.livingdocs.notification.config;

import com.livingdocs.notification.security.JwtAuthFilter;
import com.livingdocs.notification.security.RoleInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Cấu hình web cho notification-service (cổng 8086, định tuyến thật qua gateway). */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RoleInterceptor roleInterceptor = new RoleInterceptor();

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> jwtFilter(
            @Value("${app.jwt.secret}") String secret) {
        FilterRegistrationBean<JwtAuthFilter> registration =
                new FilterRegistrationBean<>(new JwtAuthFilter(secret));
        registration.addUrlPatterns("/api/*");
        registration.setOrder(1);
        return registration;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(roleInterceptor).addPathPatterns("/api/**");
    }
}
