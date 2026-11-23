package com.livingdocs.document.service;

import com.github.difflib.DiffUtils;
import com.github.difflib.patch.Patch;
import com.livingdocs.document.dto.DiffResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DocumentDiffTest {

    @Test
    void testDiffCalculation() {
        List<String> original = Arrays.asList(
            "# Title",
            "This is line 1.",
            "This is line 2."
        );
        List<String> revised = Arrays.asList(
            "# Title",
            "This is line 1 modified.",
            "This is line 2.",
            "This is line 3 added."
        );

        Patch<String> patch = DiffUtils.diff(original, revised);
        assertNotNull(patch);
        assertFalse(patch.getDeltas().isEmpty());
        assertEquals(2, patch.getDeltas().size());
    }
}

