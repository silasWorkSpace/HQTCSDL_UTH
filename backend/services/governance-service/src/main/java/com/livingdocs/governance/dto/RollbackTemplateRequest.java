package com.livingdocs.governance.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class RollbackTemplateRequest {
    @NotNull
    @Min(1)
    private Integer targetVersionNo;

    private String changeNote;

    public RollbackTemplateRequest() {}

    public RollbackTemplateRequest(Integer targetVersionNo, String changeNote) {
        this.targetVersionNo = targetVersionNo;
        this.changeNote = changeNote;
    }

    public Integer getTargetVersionNo() { return targetVersionNo; }
    public void setTargetVersionNo(Integer targetVersionNo) { this.targetVersionNo = targetVersionNo; }
    public String getChangeNote() { return changeNote; }
    public void setChangeNote(String changeNote) { this.changeNote = changeNote; }
}
