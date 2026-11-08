# LivingDocs Backend

Java Spring Boot (Maven nhieu module), Python FastAPI (ai-engine), Kafka, Redis, SQL Server.

```
backend/
  pom.xml                 parent POM (Spring Boot 4.1.x, Java 21)
  libs/common-events      topic Kafka, envelope su kien
  libs/common-security    JWT, vai tro, TenantContext
  libs/common-web         loi Problem Details, correlation id, TenantJdbc, AuditService
  services/identity-service
  infra/                  docker-compose, db.ps1, script SQL
```

## Chay nhanh (Windows PowerShell)

```powershell
cd backend\infra
.\db.ps1 up                    # SQL Server + Redis + Kafka
.\db.ps1 rebuild               # dung lai database va 2 tenant demo, acme
.\kafka-topics.ps1             # tao 5 topic Kafka

cd ..
.\mvnw.cmd -q -DskipTests install
.\mvnw.cmd -pl services/identity-service spring-boot:run "-Dspring-boot.run.profiles=dev"
```

Swagger UI: http://localhost:8081/swagger-ui.html

## Quy uoc cho moi service moi

- Them module vao `<modules>` trong `pom.xml`, khai bao parent `livingdocs-backend` va phu thuoc `common-security`, `common-web`.
- Main class dung `@SpringBootApplication(scanBasePackages = "com.livingdocs")` de nhan cau hinh dung chung.
- Truy cap DB theo tenant bang `TenantJdbc` voi placeholder `{schema}`; khong tu ghep tenant vao chuoi SQL.
- Kiem tra vai tro phia server bang `@PreAuthorize("hasRole('Manager')")`.
- Loi nghiep vu nem `ApiException`; ghi audit bang `AuditService`.
- Tenant lay tu claim `tenant` cua JWT, khong bao gio tu du lieu gui len.
