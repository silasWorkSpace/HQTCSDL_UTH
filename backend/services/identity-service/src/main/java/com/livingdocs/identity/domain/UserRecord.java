package com.livingdocs.identity.domain;

import java.util.UUID;

/** Mot dong cua bang app_user (chi cac cot dich vu nay can). */
public record UserRecord(UUID id, String email, String displayName, String passwordHash,
                         String status, String language) {
}
