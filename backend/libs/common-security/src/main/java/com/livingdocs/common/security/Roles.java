package com.livingdocs.common.security;

import java.util.Set;

/** 5 vai tro cua he thong. Dung dung cac gia tri nay o moi noi (khop CHECK trong role_assignment). */
public final class Roles {
    public static final String DEVELOPER = "Developer";
    public static final String STAFF = "Staff";
    public static final String MANAGER = "Manager";
    public static final String TECH_LEAD = "TechLead";
    public static final String ADMINISTRATOR = "Administrator";

    public static final Set<String> ALL = Set.of(DEVELOPER, STAFF, MANAGER, TECH_LEAD, ADMINISTRATOR);

    private Roles() {
    }
}
