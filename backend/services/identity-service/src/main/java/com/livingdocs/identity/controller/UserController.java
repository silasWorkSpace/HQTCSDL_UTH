package com.livingdocs.identity.controller;

import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.service.UserAdminService;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserAdminService users;

    public UserController(UserAdminService users) {
        this.users = users;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return users.me(UUID.fromString(jwt.getSubject()));
    }
}
