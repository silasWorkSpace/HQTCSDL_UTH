package com.livingdocs.workflow.service;

import com.livingdocs.workflow.repo.WorkflowRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Cổng publish: tuần này dùng bản giả lập (chưa publish thật lên GitHub —
 * commit nhánh docs và PR tài liệu làm tuần sau theo kế hoạch).
 *
 * <p>Chuỗi trạng thái sau khi Manager duyệt (FR-WF-16, FR-WF-24, UC-12):
 * APPROVED → PENDING_MERGE (commit nhánh docs giả lập) → PUBLISHED (merge giả lập),
 * kèm ghi phiên bản Published qua sp_append_document_version (FR-WF-26).
 * Ba trạng thái doc/publish/pr chỉ đổi qua sp_transition_document_status.
 */
@Component
public class PublishSimulator implements PublishPort {

    private static final Logger log = LoggerFactory.getLogger(PublishSimulator.class);

    private final WorkflowRepository repo;

    public PublishSimulator(WorkflowRepository repo) {
        this.repo = repo;
    }

    @Override
    public UUID publish(String tenant, UUID documentId) {
        // Luồng hệ thống (sau quyết định Manager), không có JWT trong context
        UUID systemActor = null;

        // 1. "Commit" vào nhánh docs riêng, mở PR tài liệu (giả lập) → Pending Merge
        repo.transitionDocument(tenant, documentId, "PENDING_MERGE", "system", systemActor);
        log.info("[Publish gia lap] Tai lieu {} -> PENDING_MERGE (docs branch livingdocs/{})",
                documentId, documentId);

        // 2. PR tài liệu merge thành công → Published, ghi phiên bản Published (FR-WF-26)
        repo.transitionDocument(tenant, documentId, "PUBLISHED", "system", systemActor);
        WorkflowRepository.DocumentRow doc = repo.findDocument(tenant, documentId)
                .orElseThrow(() -> new IllegalStateException("Tài liệu mất giữa lúc publish"));
        String publishedContent = repo.findVersion(tenant, doc.currentVersionId())
                .map(WorkflowRepository.VersionRow::content).orElse("");
        repo.appendDocumentVersion(tenant, documentId, publishedContent, "Manager", null,
                "REVIEW_ACTION", "Ghi phiên bản Published sau khi PR tài liệu merge (giả lập)");
        log.info("[Publish gia lap] Tai lieu {} -> PUBLISHED, da ghi phien ban Published", documentId);
        return documentId;
    }
}
