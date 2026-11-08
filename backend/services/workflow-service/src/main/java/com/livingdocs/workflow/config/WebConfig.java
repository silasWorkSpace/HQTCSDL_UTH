package com.livingdocs.workflow.config;

import com.livingdocs.workflow.security.JwtAuthFilter;
import com.livingdocs.workflow.security.RoleInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Cấu hình web: lọc JWT cho mọi đường dẫn trừ swagger/health và kiểm tra
 * vai trò qua interceptor. Định tuyến thật sẽ qua api-gateway (cổng 8080).
 */
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
