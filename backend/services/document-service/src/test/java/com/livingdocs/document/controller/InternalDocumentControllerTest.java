package com.livingdocs.document.controller;

import com.livingdocs.document.dto.DocCodeLinkResponse;
import com.livingdocs.document.dto.InternalDocumentVersionDto;
import com.livingdocs.document.service.DocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class InternalDocumentControllerTest {

    private DocumentService documentService;
    private JdbcTemplate jdbcTemplate;
    private InternalDocumentController controller;
    private final String internalToken = "secret-internal-service-token-12345";

    @BeforeEach
    void setUp() {
        documentService = Mockito.mock(DocumentService.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        controller = new InternalDocumentController(documentService, jdbcTemplate, internalToken);
    }

    @Test
    void testGetDocumentVersion_UnauthorizedWhenTokenInvalid() {
        UUID docId = UUID.randomUUID();
        assertThrows(ResponseStatusException.class, () ->
            controller.getDocumentVersion(docId, null, "demo", "wrong-token")
        );
        assertThrows(ResponseStatusException.class, () ->
            controller.getDocumentVersion(docId, null, "demo", null)
        );
    }

    @Test
    void testGetDocumentVersion_Success() {
        UUID docId = UUID.randomUUID();
        UUID verId = UUID.randomUUID();
        InternalDocumentVersionDto dto = new InternalDocumentVersionDto(
            verId, docId, 1, "README", "docs/readme.md", "README", "DRAFT", "# Hello", null, null, "AI_GENERATION", Instant.now()
        );

        Mockito.when(jdbcTemplate.query(Mockito.anyString(), Mockito.<RowMapper<InternalDocumentVersionDto>>any(), Mockito.eq(docId)))
                .thenReturn(List.of(dto));

        InternalDocumentVersionDto result = controller.getDocumentVersion(docId, null, "demo", internalToken);
        assertNotNull(result);
        assertEquals(docId, result.getDocumentId());
        assertEquals("README", result.getTitle());
    }

    @Test
    void testGetDocumentLinks_Success() {
        UUID docId = UUID.randomUUID();
        DocCodeLinkResponse link = new DocCodeLinkResponse(UUID.randomUUID(), docId, "CODE_ENTITY", UUID.randomUUID(), null, Instant.now());
        Mockito.when(documentService.getDocumentLinks(docId)).thenReturn(List.of(link));

        List<DocCodeLinkResponse> links = controller.getDocumentLinks(docId, "demo", internalToken);
        assertNotNull(links);
        assertEquals(1, links.size());
    }
}
