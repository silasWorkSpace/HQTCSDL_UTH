package com.livingdocs.identity.controller;

import com.livingdocs.identity.dto.SwitchRoleRequest;
import com.livingdocs.identity.dto.UserResponse;
import com.livingdocs.identity.service.UserAdminService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @PostMapping("/me/switch-role")
    public UserResponse switchRole(@Valid @RequestBody SwitchRoleRequest request,
                                   @AuthenticationPrincipal Jwt jwt,
                                   HttpServletResponse response) {
        return users.switchRole(UUID.fromString(jwt.getSubject()), request.role(), jwt, response);
    }
}
