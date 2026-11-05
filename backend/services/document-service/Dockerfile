FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/*.jar app.jar

ENV PORT=8083
ENV DB_URL=jdbc:sqlserver://localhost:1433;databaseName=livingdocs;trustServerCertificate=true;encrypt=false
ENV DB_USER=sa
ENV DB_PASSWORD=LivingDocsPassw0rd!
ENV KAFKA_SERVERS=localhost:9092
ENV JWT_SECRET=LivingDocsSuperSecretKeyForJWTAuthentication2026LivingDocs!

EXPOSE 8083

ENTRYPOINT ["java", "-jar", "app.jar"]

