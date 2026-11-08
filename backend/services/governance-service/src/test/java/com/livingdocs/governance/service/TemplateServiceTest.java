package com.livingdocs.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

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
    void testArchiveTemplate_NotFound() {
        java.util.UUID randomId = java.util.UUID.randomUUID();
        Mockito.when(jdbcTemplate.update(Mockito.anyString(), Mockito.any(), Mockito.eq(randomId))).thenReturn(0);
        assertThrows(RuntimeException.class, () -> templateService.archiveTemplate(randomId));
    }
}

