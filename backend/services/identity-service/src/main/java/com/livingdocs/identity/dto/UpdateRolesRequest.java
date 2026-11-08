package com.livingdocs.identity.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/** Tap vai tro ap dung cho CA workspace; thay the toan bo vai tro workspace hien co cua nguoi dung. */
public record UpdateRolesRequest(@NotNull List<String> roles) {
}
