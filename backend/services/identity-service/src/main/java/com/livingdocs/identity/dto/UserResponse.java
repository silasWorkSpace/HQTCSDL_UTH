package com.livingdocs.identity.dto;

import java.util.List;

public record UserResponse(String id, String email, String displayName, String status, String language,
                           List<String> roles) {
}
