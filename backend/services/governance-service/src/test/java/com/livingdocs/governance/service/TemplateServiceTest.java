package com.livingdocs.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livingdocs.governance.dto.RollbackTemplateRequest;
import com.livingdocs.governance.dto.TemplatePreviewRequest;
import com.livingdocs.governance.dto.TemplatePreviewResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TemplateServiceTest {

    private JdbcTemplate jdbcTemplate;
    private ObjectMapper objectMapper;
    private TemplateService templateService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        objectMapper = new ObjectMapper();
        templateService = new TemplateService(jdbcTemplate, objectMapper);
    }

    @Test
    void testValidateJson_ValidJson() {
        assertDoesNotThrow(() -> templateService.validateJson("{\"sections\": [{\"key\": \"overview\"}]}"));
    }

    @Test
    void testValidateJson_InvalidJson() {
        assertThrows(IllegalArgumentException.class, () -> templateService.validateJson("{unclosed_json:"));
    }

    @Test
    void testValidateJson_EmptyOrNull() {
        assertThrows(IllegalArgumentException.class, () -> templateService.validateJson(""));
        assertThrows(IllegalArgumentException.class, () -> templateService.validateJson(null));
    }

    @Test
    void testValidateSections_ValidSchema() {
        String valid = "{\"sections\": [{\"key\": \"overview\", \"title\": \"Tổng quan\", \"required\": true}]}";
        assertDoesNotThrow(() -> templateService.validateSections(valid));
    }

    @Test
    void testValidateSections_MissingKeyOrTitle() {
        String missingKey = "{\"sections\": [{\"title\": \"Tổng quan\"}]}";
        assertThrows(IllegalArgumentException.class, () -> templateService.validateSections(missingKey));

        String missingTitle = "{\"sections\": [{\"key\": \"overview\"}]}";
        assertThrows(IllegalArgumentException.class, () -> templateService.validateSections(missingTitle));
    }

    @Test
    void testRenderPreview_ReplacesVariablesAndPlaceholders() {
        String sections = "{\"sections\": [" +
            "{\"key\": \"intro\", \"title\": \"Giới thiệu\", \"required\": true}," +
            "{\"key\": \"endpoints\", \"title\": \"Endpoints\", \"placeholder\": \"{{endpoint_list}}\"}" +
            "]}";

        TemplatePreviewResponse res = templateService.renderPreview(sections, "{\"lang\": \"vi\"}", Map.of("intro", "Nội dung giới thiệu tùy chỉnh."));
        assertNotNull(res);
        assertNotNull(res.getPreviewMarkdown());
        assertTrue(res.getPreviewMarkdown().contains("## Giới thiệu"));
        assertTrue(res.getPreviewMarkdown().contains("Nội dung giới thiệu tùy chỉnh."));
        assertTrue(res.getPreviewMarkdown().contains("## Endpoints"));
        assertTrue(res.getPreviewMarkdown().contains("endpoint_list"));
        assertEquals(2, res.getParsedSections().size());
    }

    @Test
    void testArchiveTemplate_NotFound() {
        UUID randomId = UUID.randomUUID();
        Mockito.when(jdbcTemplate.update(Mockito.anyString(), Mockito.any(), Mockito.eq(randomId))).thenReturn(0);
        assertThrows(RuntimeException.class, () -> templateService.archiveTemplate(randomId));
    }
}
