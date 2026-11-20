package com.livingdocs.identity.dto;

public record AuthSessionResponse(boolean authenticated, String githubConnectionId) {}
