package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateDraftRequest {
    @NotBlank
    private String content;

    public UpdateDraftRequest() {}

    public UpdateDraftRequest(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}

