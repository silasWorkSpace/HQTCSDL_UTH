package com.livingdocs.integration.controller;

import com.livingdocs.integration.dto.AddRepositoryRequest;
import com.livingdocs.integration.dto.RepositoryDto;
import com.livingdocs.integration.service.RepositoryManagementService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RepositoryController.class)
class RepositoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RepositoryManagementService repositoryService;

    @Test
    @DisplayName("GH-05: Liệt kê danh sách repositories trả về HTTP 200")
    void testListRepositories() throws Exception {
        UUID repoId = UUID.randomUUID();
        RepositoryDto repo = new RepositoryDto(
                repoId, UUID.randomUUID(), 12345678L,
                "livingdocs/core", "main", "connected",
                Instant.now(), Instant.now()
        );

        Mockito.when(repositoryService.listRepositories()).thenReturn(List.of(repo));

        mockMvc.perform(get("/api/v1/repositories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(repoId.toString()))
                .andExpect(jsonPath("$[0].fullName").value("livingdocs/core"));
    }

    @Test
    @DisplayName("GH-04: Ngắt kết nối repository trả về HTTP 204 No Content")
    void testDisconnectRepository() throws Exception {
        UUID repoId = UUID.randomUUID();
        Mockito.doNothing().when(repositoryService).disconnectRepository(repoId);

        mockMvc.perform(delete("/api/v1/repositories/" + repoId))
                .andExpect(status().isNoContent());

        Mockito.verify(repositoryService).disconnectRepository(repoId);
    }
}
