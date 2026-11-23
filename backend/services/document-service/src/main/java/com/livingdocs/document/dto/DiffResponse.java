package com.livingdocs.document.dto;

import java.util.List;

public class DiffResponse {
    private Integer fromVersion;
    private Integer toVersion;
    private List<String> diffLines;

    public DiffResponse() {}

    public DiffResponse(Integer fromVersion, Integer toVersion, List<String> diffLines) {
        this.fromVersion = fromVersion;
        this.toVersion = toVersion;
        this.diffLines = diffLines;
    }

    public Integer getFromVersion() { return fromVersion; }
    public void setFromVersion(Integer fromVersion) { this.fromVersion = fromVersion; }
    public Integer getToVersion() { return toVersion; }
    public void setToVersion(Integer toVersion) { this.toVersion = toVersion; }
    public List<String> getDiffLines() { return diffLines; }
    public void setDiffLines(List<String> diffLines) { this.diffLines = diffLines; }
}

