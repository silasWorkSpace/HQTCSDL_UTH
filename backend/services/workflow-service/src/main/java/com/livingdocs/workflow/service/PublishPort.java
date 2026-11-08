package com.livingdocs.workflow.service;

import java.util.UUID;

/**
 * Cổng đưa bản đã duyệt vào nhánh đích. Tuần này: giả lập ({@link PublishSimulator});
 * tuần sau: implement thật qua GitHub API (commit nhánh docs, mở PR tài liệu).
 */
public interface PublishPort {

    UUID publish(String tenant, UUID documentId);
}
