package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public class UpdateDraftRequest {
    @NotBlank
    private String content;
    @NotNull @Positive
    private Integer baseVersionNo;

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

    public Integer getBaseVersionNo() { return baseVersionNo; }
    public void setBaseVersionNo(Integer baseVersionNo) { this.baseVersionNo = baseVersionNo; }
}

