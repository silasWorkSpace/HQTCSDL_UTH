package com.livingdocs.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class RollbackRequest {
    @NotNull
    private Integer targetVersionNo;

    @NotBlank
    private String reason;

    public RollbackRequest() {}

    public RollbackRequest(Integer targetVersionNo, String reason) {
        this.targetVersionNo = targetVersionNo;
        this.reason = reason;
    }

    public Integer getTargetVersionNo() {
        return targetVersionNo;
    }

    public void setTargetVersionNo(Integer targetVersionNo) {
        this.targetVersionNo = targetVersionNo;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}

