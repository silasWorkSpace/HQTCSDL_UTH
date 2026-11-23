package com.livingdocs.integration.dto;

import java.util.UUID;

public record CodeEntityDto(UUID id, UUID repositoryId, UUID parentId, String kind,
        String name, String signature, String filePath, String commitHash) {}
